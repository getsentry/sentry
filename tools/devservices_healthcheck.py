from __future__ import annotations

import os
import subprocess
import time


def run_cmd(
    args: list[str],
    *,
    retries: int = 3,
    timeout: int = 5,
) -> None:
    for retry in range(1, retries + 1):
        returncode = subprocess.call(args)

        if returncode != 0:
            time.sleep(timeout)
        else:
            return

    raise SystemExit(1)


def main() -> None:
    # Available health checks
    postgres_healthcheck = ["docker", "exec", "sentry_postgres", "pg_isready", "-U", "postgres"]
    kafka_healthcheck = [
        "docker",
        "exec",
        "sentry_kafka",
        "rpk",
        "topic",
        "list",
    ]

    healthchecks = [postgres_healthcheck]
    if os.getenv("NEED_KAFKA") == "true":
        healthchecks.append(kafka_healthcheck)

    for check in healthchecks:
        run_cmd(check)


if __name__ == "__main__":
    main()
