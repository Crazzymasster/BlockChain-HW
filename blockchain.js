let blockchain = [];
let blockCounter = 0;
let networkNodes = {};
let currentNodeId = 'node-1';
let nodeCount = 5;

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}
async function calculateBlockHash(block) {
    const blockdata = {
        blockNumber: block.blockNumber,
        timestamp: block.timestamp,
        previousHash: block.previousHash,
        transactions: block.transactions.map(tx => ({
            sender: tx.sender,
            receiver: tx.receiver,
            amount: tx.amount,
            timestamp: tx.timestamp
        }))
    };

    const dataString = JSON.stringify(blockdata);

    return await sha256(dataString);
    }

async function updateBlockHash(blockIndex) {
    if (blockIndex >= 0 && blockIndex < blockchain.length) {
        const block = blockchain[blockIndex];
        block.hash = await calculateBlockHash(block);
        const hashElement = document.getElementById(`hash-${blockIndex}`);
        if (hashElement) {
            hashElement.textContent = block.hash;
        }
    }
}

async function recalculateAllHashes() {
    for (let i = 0; i < blockchain.length; i++) {
        await updateBlockHash(i);
    }
    networkNodes[currentNodeId].blockchain = blockchain;
}

async function verifyBlockchain() {
    let isValid = true;

    for (let i = 0; i < blockchain.length; i++) {
        const block = blockchain[i];

        const calculatedHash = await calculateBlockHash(block);

        const hashMatches = (block.hash === calculatedHash);
        
        let chainIntact = true;
        if (i < blockchain.length - 1) {
            const nextBlock = blockchain[i + 1];
            chainIntact = (nextBlock.previousHash === block.hash);
        }

        const blockDiv = document.getElementById(`block-${i}`);

        if(blockDiv){
            blockDiv.classList.remove('valid-block', 'invalid-block');
        }

        if(hashMatches && chainIntact){
            if(blockDiv){
                blockDiv.classList.add('valid-block');
            }
        } else {
            isValid = false;
            if(blockDiv){
                blockDiv.classList.add('invalid-block');
            }
        }
    }
    
    const statusElement = document.getElementById('verification-result');
    if(statusElement){
        statusElement.className = isValid ? 'verification-success' : 'verification-failure';
        statusElement.textContent = isValid ? '✓ Blockchain is valid!' : '✗ Blockchain has been tampered with!';
    }
}

async function addTransaction() {
    const sender = document.getElementById('sender').value.trim();
    const receiver = document.getElementById('receiver').value.trim();
    const amount = document.getElementById('amount').value;

    if (!sender || !receiver || !amount) {
        alert('Please fill in all fields!');
        return;
    }

    const transaction = {
        sender: sender,
        receiver: receiver,
        amount: parseFloat(amount),
        timestamp: new Date().toLocaleString()
    };

    // Broadcast to all nodes
    for (const nodeId in networkNodes) {
        const node = networkNodes[nodeId];
        
        const previousHash = node.blockchain.length > 0 
            ? node.blockchain[node.blockchain.length - 1].hash 
            : '0';

        const currentHash = await calculateBlockHash({
            blockNumber: node.blockCounter,
            timestamp: transaction.timestamp,
            previousHash: previousHash,
            transactions: [transaction]
        });

        const block = {
            blockNumber: node.blockCounter++,
            timestamp: transaction.timestamp,
            previousHash: previousHash,
            transactions: [transaction],
            hash: currentHash
        };

        node.blockchain.push(block);
    }
    
    // Update current view
    const currentNode = networkNodes[currentNodeId];
    blockchain = currentNode.blockchain;
    blockCounter = currentNode.blockCounter;
    
    document.getElementById('sender').value = '';
    document.getElementById('receiver').value = '';
    document.getElementById('amount').value = '';

    renderBlockchain();
    updateNetworkStatus();
}

function renderBlockchain() {
    const container = document.getElementById('blockchain');

    container.addEventListener('input', async (event) => {
        const target = event.target;
        if (target.classList.contains('transaction-value')) {
            const blockIndex = parseInt(target.dataset.block);
            const txIndex = parseInt(target.dataset.tx);
            const field = target.dataset.field;
            let value = target.textContent.trim();
            if (field === 'amount') {
                value = value.replace('$', '');
                blockchain[blockIndex].transactions[txIndex][field] = parseFloat(value) || 0;
            } else {
                blockchain[blockIndex].transactions[txIndex][field] = value;
            }
            await recalculateAllHashes();
        }
    });

    if (blockchain.length === 0) {
        container.innerHTML = '<div class="no-blocks">No transactions yet.</div>';
        return;
    }

    container.innerHTML = '';

    blockchain.forEach((block, blockIndex) => {
        const blockDiv = document.createElement('div');
        blockDiv.className = 'block';
        blockDiv.id = `block-${blockIndex}`;

        let transactionsHTML = '';
        block.transactions.forEach((tx, txIndex) => {
            transactionsHTML += `
                <div class="transaction" id="tx-${blockIndex}-${txIndex}">
                    <div class="transaction-row">
                        <span class="transaction-label">From:</span>
                        <span class="transaction-value editable" contenteditable="true" 
                              data-block="${blockIndex}" data-tx="${txIndex}" data-field="sender">${tx.sender}</span>
                    </div>
                    <div class="transaction-row">
                        <span class="transaction-label">To:</span>
                        <span class="transaction-value editable" contenteditable="true" 
                              data-block="${blockIndex}" data-tx="${txIndex}" data-field="receiver">${tx.receiver}</span>
                    </div>
                    <div class="transaction-row">
                        <span class="transaction-label">Amount:</span>
                        <span class="transaction-value amount editable" contenteditable="true" 
                              data-block="${blockIndex}" data-tx="${txIndex}" data-field="amount">$${tx.amount.toFixed(2)}</span>
                    </div>
                    <div class="transaction-row">
                        <span class="transaction-label">Time:</span>
                        <span class="transaction-value">${tx.timestamp}</span>
                    </div>
                </div>
            `;
        });

        blockDiv.innerHTML = `
            <div class="block-header">
                <span class="block-number">Block #${block.blockNumber}</span>
                <span class="block-timestamp">${block.timestamp}</span>
            </div>
            <div class="hash-section">
                <span class="hash-label">Previous Hash:</span>
                <span class="hash-value" id="prev-hash-${blockIndex}">${block.previousHash || '0'}</span>
            </div>
            <div class="hash-section">
                <span class="hash-label">Hash:</span>
                <span class="hash-value" id="hash-${blockIndex}">${block.hash || 'Not yet calculated'}</span>
            </div>
            <div class="transaction-list">
                ${transactionsHTML}
            </div>
        `;

        container.appendChild(blockDiv);
    });
}

document.addEventListener('blur', function(e) {
    if (e.target.classList.contains('editable')) {
        const blockIndex = parseInt(e.target.dataset.block);
        const txIndex = parseInt(e.target.dataset.tx);
        const field = e.target.dataset.field;
        let value = e.target.textContent.trim();
        
        if (field === 'amount') {
            value = value.replace('$', '');
            blockchain[blockIndex].transactions[txIndex][field] = parseFloat(value) || 0;
        } else {
            blockchain[blockIndex].transactions[txIndex][field] = value;
        }
        
        renderBlockchain();
    }
}, true);

initializeNetwork();
renderBlockchain();

function initializeNetwork() {
    for (let i = 1; i <= nodeCount; i++) {
        const nodeId = `node-${i}`;
        networkNodes[nodeId] = {
            id: nodeId,
            name: `Node ${i}`,
            blockchain: [],
            blockCounter: 0,
            status: 'in-sync',
            statusText: 'In Sync'
        };
    }
    renderNodeSelector();
}

function renderNodeSelector() {
    const container = document.getElementById('node-selector');
    if (!container) return;
    
    let html = '';
    Object.values(networkNodes).forEach(node => {
        const isActive = node.id === currentNodeId;
        const statusClass = node.status || 'in-sync';
        const statusText = node.statusText || 'In Sync';
        html += `
            <div class="node-card ${isActive ? 'active-node' : ''}" onclick="switchNode('${node.id}')">
                <div class="node-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/>
                        <circle cx="12" cy="12" r="3" fill="currentColor"/>
                    </svg>
                </div>
                <div class="node-name">${node.name}</div>
                <div class="node-status ${statusClass}" id="status-${node.id}">${statusText}</div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function switchNode(nodeId) {
    currentNodeId = nodeId;
    const node = networkNodes[nodeId];
    blockchain = node.blockchain;
    blockCounter = node.blockCounter;
    renderNodeSelector();
    renderBlockchain();
}

async function syncTransaction() {
    const sender = document.getElementById('sender').value.trim();
    const receiver = document.getElementById('receiver').value.trim();
    const amount = document.getElementById('amount').value;

    if (!sender || !receiver || !amount) {
        alert('Please fill in all fields!');
        return;
    }

    const transaction = {
        sender: sender,
        receiver: receiver,
        amount: parseFloat(amount),
        timestamp: new Date().toLocaleString()
    };

    // Broadcast to all nodes
    for (const nodeId in networkNodes) {
        const node = networkNodes[nodeId];
        
        const previousHash = node.blockchain.length > 0 
            ? node.blockchain[node.blockchain.length - 1].hash 
            : '0';

        const currentHash = await calculateBlockHash({
            blockNumber: node.blockCounter,
            timestamp: transaction.timestamp,
            previousHash: previousHash,
            transactions: [transaction]
        });

        const block = {
            blockNumber: node.blockCounter++,
            timestamp: transaction.timestamp,
            previousHash: previousHash,
            transactions: [transaction],
            hash: currentHash
        };

        node.blockchain.push(block);
    }
    
    // Update current view
    const currentNode = networkNodes[currentNodeId];
    blockchain = currentNode.blockchain;
    blockCounter = currentNode.blockCounter;
    
    document.getElementById('sender').value = '';
    document.getElementById('receiver').value = '';
    document.getElementById('amount').value = '';

    renderBlockchain();
    updateNetworkStatus();
}

function updateNetworkStatus() {
    Object.values(networkNodes).forEach(node => {
        node.status = 'in-sync';
        node.statusText = 'In Sync';
        const statusElement = document.getElementById(`status-${node.id}`);
        if (statusElement) {
            statusElement.textContent = 'In Sync';
            statusElement.className = 'node-status in-sync';
        }
    });
}

async function validateNetworkConsensus() {
    const blockchainHashes = {};
    
    // Calculate hash for each node's blockchain
    for (const nodeId in networkNodes) {
        const node = networkNodes[nodeId];
        const chainHash = await calculateChainHash(node.blockchain);
        
        if (!blockchainHashes[chainHash]) {
            blockchainHashes[chainHash] = [];
        }
        blockchainHashes[chainHash].push(nodeId);
    }
    
    // Find majority consensus
    const hashCounts = Object.entries(blockchainHashes).map(([hash, nodes]) => ({
        hash,
        nodes,
        count: nodes.length
    }));
    
    hashCounts.sort((a, b) => b.count - a.count);
    const consensusHash = hashCounts[0].hash;
    const consensusNodes = hashCounts[0].nodes;
    
    const statusElement = document.getElementById('consensus-result');
    
    if (hashCounts.length === 1) {
        // All nodes agree
        statusElement.className = 'consensus-success';
        statusElement.textContent = `Network Consensus: All ${nodeCount} nodes are in sync!`;
        
        Object.values(networkNodes).forEach(node => {
            node.status = 'in-sync';
            node.statusText = 'In Sync';
            const nodeStatus = document.getElementById(`status-${node.id}`);
            if (nodeStatus) {
                nodeStatus.textContent = 'In Sync';
                nodeStatus.className = 'node-status in-sync';
            }
        });
    } else {
        // Some nodes disagree
        const rejectedNodes = Object.keys(networkNodes).filter(id => !consensusNodes.includes(id));
        
        statusElement.className = 'consensus-failure';
        statusElement.textContent = `Network Rejected: ${rejectedNodes.length} node(s) have invalid blockchain! Majority (${consensusNodes.length}/${nodeCount}) nodes agree on the true chain.`;
        
        Object.values(networkNodes).forEach(node => {
            const nodeStatus = document.getElementById(`status-${node.id}`);
            if (nodeStatus) {
                if (consensusNodes.includes(node.id)) {
                    node.status = 'in-sync';
                    node.statusText = 'In Sync';
                    nodeStatus.textContent = 'In Sync';
                    nodeStatus.className = 'node-status in-sync';
                } else {
                    node.status = 'rejected';
                    node.statusText = 'Rejected';
                    nodeStatus.textContent = 'Rejected';
                    nodeStatus.className = 'node-status rejected';
                }
            }
        });
    }
}

async function calculateChainHash(chain) {
    const chainString = JSON.stringify(chain.map(block => ({
        blockNumber: block.blockNumber,
        hash: block.hash,
        previousHash: block.previousHash
    })));
    return await sha256(chainString);
}
