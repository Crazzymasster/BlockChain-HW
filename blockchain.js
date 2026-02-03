let blockchain = [];
let blockCounter = 0;

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
}

async function verifyBlockchain() {
    let isValid = true;

    for (let i = 0; i < blockchain.length; i++) {
        const block = blockchain[i];

        const calculatedHash = await calculateBlockHash(block);

        // Check if this block's hash matches its data
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

        // Block is valid only if its data is correct AND the next block's chain link is intact
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

    // Get previous block's hash (or '0' for genesis block)
    const previousHash = blockchain.length > 0 
        ? blockchain[blockchain.length - 1].hash 
        : '0';

    const currentHash = await calculateBlockHash({
        blockNumber: blockCounter,
        timestamp: new Date().toLocaleString(),
        previousHash: previousHash,
        transactions: [transaction]
    });

    // Create a new block with this transaction
    const block = {
        blockNumber: blockCounter++,
        timestamp: new Date().toLocaleString(),
        previousHash: previousHash,
        transactions: [transaction],
        hash: currentHash 
    };

    blockchain.push(block);
    
    // Clear the form
    document.getElementById('sender').value = '';
    document.getElementById('receiver').value = '';
    document.getElementById('amount').value = '';

    renderBlockchain();
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
        container.innerHTML = '<div class="no-blocks">No transactions yet. Add your first transaction above!</div>';
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

// Handle inline editing of transaction fields
document.addEventListener('blur', function(e) {
    if (e.target.classList.contains('editable')) {
        const blockIndex = parseInt(e.target.dataset.block);
        const txIndex = parseInt(e.target.dataset.tx);
        const field = e.target.dataset.field;
        let value = e.target.textContent.trim();
        
        // Remove $ sign if editing amount
        if (field === 'amount') {
            value = value.replace('$', '');
            blockchain[blockIndex].transactions[txIndex][field] = parseFloat(value) || 0;
        } else {
            blockchain[blockIndex].transactions[txIndex][field] = value;
        }
        
        // Re-render to update display format
        renderBlockchain();
    }
}, true);


// Initialize with empty blockchain
renderBlockchain();
