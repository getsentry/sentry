import copy
import functools
import logging
import re
import time

import web3
from web3 import Web3

logger = logging.getLogger("sentry.utils.ethereum.network")

# Disable some web3 loggers
for _ in (
    "web3.providers.HTTPProvider",
    "web3.RequestManager",
):
    logging.getLogger(_).setLevel(logging.CRITICAL)


DEFAULT_ERROR_MESSAGE = "Transaction reverted"


def retry_with_delay(on, ignore=None, attempts=3, delay=0.1, reraise=False):
    """
    Retry with delays
    """

    def decorator_retry(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for i in range(attempts):
                try:
                    return func(*args, **kwargs)
                except on as e:
                    if ignore and isinstance(e, ignore):
                        raise
                    logger.debug("Caught %s, retrying %s after delay, attempt %s", type(e), func, i)
                    time.sleep(delay)
                    if i == attempts - 1:
                        # Last iteration
                        if reraise:
                            raise
                        else:
                            logger.error(e)

        return wrapper

    return decorator_retry


class EthereumNetwork:
    def __init__(self, provider_uri: str) -> None:
        if not provider_uri:
            raise ValueError("No provider_uri specified")
        self.w3 = Web3(Web3.HTTPProvider(provider_uri))

    @retry_with_delay(on=(web3.exceptions.TransactionNotFound, ValueError), delay=0.5)
    def get_transaction_receipt(self, tr_id: str):
        return self.w3.eth.get_transaction_receipt(tr_id)

    @retry_with_delay(on=(ValueError), ignore=web3.exceptions.SolidityError, delay=0.5)
    def eth_call(self, transaction, block_identifier):
        return self.w3.eth.call(transaction, block_identifier=block_identifier)

    def process_transaction(self, transaction):
        filter_addrs = ["0x7a250d5630b4cf539739df2c5dacb4c659f2488d"]
        for addr in filter_addrs:
            addr = addr.lower()
            if (transaction["from"] or "").lower() == addr or (
                transaction["to"] or ""
            ).lower() == addr:
                tr_id = transaction["hash"].hex()
                logger.debug("Transaction matches the filter: %s", tr_id)
                receipt = self.get_transaction_receipt(tr_id)
                if receipt and receipt["status"] == 0:
                    # Errored transaction => handle it!
                    logger.info("Failed transaction: %s", tr_id)
                    err_reason = self.get_transaction_err_reason(transaction)
                    if not err_reason:
                        err_reason = DEFAULT_ERROR_MESSAGE
                    logger.info("Error message: %s", err_reason)
                    # TODO: send a Sentry error

    def process_block(self, block):
        for transaction in block["transactions"]:
            self.process_transaction(transaction)

    def scan_blocks(self, block_number="latest"):
        logger.debug("Starting the scan loop...")
        while True:
            try:
                block = self.w3.eth.get_block(block_number, full_transactions=True)
                block_number = block.number
                self.process_block(block)
                logger.info("Block %s processed", block_number)
                block_number += 1
            except web3.exceptions.BlockNotFound:
                pass
            logger.info("Waiting for the next block...")
            time.sleep(1.0)

    def clone_transaction(self, tr):
        """
        Return the sanitized and serializable copy of the transaction
        """
        tr = copy.deepcopy(dict(tr))
        for el in ["blockHash", "hash", "r", "s"]:
            tr[el] = tr[el].hex()

        for el in ["gasPrice", "gas", "maxFeePerGas", "maxPriorityFeePerGas"]:
            tr.pop(el, None)
        return tr

    def get_transaction_err_reason(self, tr):
        block_number = tr["blockNumber"]
        sanitized = self.clone_transaction(tr)
        reason = ""
        try:
            self.eth_call(sanitized, block_identifier=block_number)
        except web3.exceptions.SolidityError as e:
            reason = re.sub(r"^execution reverted:\s+", "", e.args[0])
        except ValueError as e:
            logger.error(e)

        return reason
