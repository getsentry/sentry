#!/usr/bin/env python
import argparse
import datetime
import logging
import os
import sys
import time

import sentry_sdk


def main(args):
    if args.dsn is None:
        raise Exception("DSN not found, please set env variable SENTRY_DSN")

    kwargs = dict(
        traces_sample_rate=1.0,
        release=args.release,
    )
    if args.environment:
        kwargs.update(environment=args.environment)

    logging.info(f"Init sentry SDK with {kwargs}")

    sentry_sdk.init(
        args.dsn,
        **kwargs,
    )

    count = 1
    transaction_name = args.transaction_name

    for _ in range(args.transaction_count):
        time.sleep(0.3)
        logging.info(
            f"Sending transaction `/{transaction_name}` {count}, time now: {datetime.datetime.now()}"
        )
        try:
            with sentry_sdk.start_transaction(name=f"/{transaction_name}"):
                raise Exception
        except Exception:
            pass
        count += 1


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description="Send transactions to sentry.")

    parser.add_argument(
        "--dsn",
        metavar="http://foo@localhost:3001/11",
        type=str,
        default=os.environ.get("SENTRY_DSN"),
        help="Sentry project DSN",
    )
    parser.add_argument("--transaction-count", type=int, default=100, help="Transactions count")

    parser.add_argument("--transaction-name", type=str, help="Transactions name to send")

    parser.add_argument("--release", type=str, default="python-demo@4.0.1", help="Release")
    parser.add_argument("--environment", type=str, help="Env")

    args = parser.parse_args()
    if len(sys.argv) == 1:
        parser.print_help()
        sys.exit(1)
    main(args)
