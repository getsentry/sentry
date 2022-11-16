import logging
import os
import subprocess
from time import sleep
from typing import List


def run_cmd(
    args: List[str],
    *,
    retries: int = 3,
    timeout: int = 5,
) -> int:
    cmd = " ".join(args)
    for retry in range(1, retries + 1):
        logging.info(f"Running {retry} health check {cmd!r}...")
        try:
            returncode = subprocess.call(args)
        except Exception:
            continue

        if returncode != 0:
            sleep(timeout)
        else:
            logging.info(f"Check: {cmd!r}\t[OK]")
            return 0

    logging.info(f"Check {cmd!r}\t[FAIL]")
    return 1


def main() -> None:
    # Available health checks
    postgres_healthcheck = "docker exec sentry_postgres pg_isready -U postgres".split(" ")
    kafka_healthcheck = (
        "docker exec sentry_kafka kafka-topics --zookeeper 127.0.0.1:2181 --list".split(" ")
    )

    healthchecks = list()
    healthchecks.append(postgres_healthcheck)
    if os.getenv("NEED_KAFKA") == "true":
        healthchecks.append(kafka_healthcheck)

    for check in healthchecks:
        result = run_cmd(check)
        if result != 0:
            raise SystemExit(result)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s: %(message)s")
    main()
