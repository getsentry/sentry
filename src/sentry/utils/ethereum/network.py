import logging
import time

import web3
from web3 import Web3

logger = logging.getLogger("sentyr.utils.ethereum.network")


class EthereumNetwork:
    def __init__(self, provider_uri: str) -> None:
        if not provider_uri:
            raise ValueError("No provider_uri specified")
        self.w3 = Web3(Web3.HTTPProvider(provider_uri))

    def process_tx(self, tx):
        contract_addrs = []
        for addr in contract_addrs:
            addr = addr.lower()
            if (tx["from"] or "").lower() == addr or (tx["to"] or "").lower() == addr:
                receipt = self.w3.eth.get_transaction_receipt(tx["hash"].hex())
                # print(receipt['status'])
                if receipt["status"] == 0:
                    # Errored tx
                    # print(tx["hash"].hex())
                    pass

    def process_block(self, block):
        # print('tx in block', len(block['transactions']))
        for transaction in block["transactions"]:
            self.process_tx(transaction)

    def scan_blocks(self, block_number="latest"):
        while True:
            try:
                block = self.w3.eth.get_block(block_number, full_transactions=True)
                block_number = block.number
                self.process_block(block)
                logger.info(block_number, "processed")
                block_number += 1
            except web3.exceptions.BlockNotFound:
                pass
            logger.info("Waiting for the next block...")
            time.sleep(1.0)
