from __future__ import annotations

import subprocess
from time import sleep


def run_cmd(
    args: list[str],
    *,
    retries: int = 3,
    timeout: int = 5,
) -> None:
    for retry in range(1, retries + 1):
        returncode = subprocess.call(args, stdout=subprocess.DEVNULL)

        if returncode != 0:
            sleep(timeout)
        else:
            return

    raise SystemExit(1)


def main() -> None:
    for check in (
        ("docker", "exec", "sentry_postgres", "pg_isready", "-U", "postgres"),
        (
            "docker",
            "exec",
            "sentry_kafka",
            "kafka-topics",
            "--zookeeper",
            "sentry_zookeeper:2181",
            "--list",
        ),
    ):
        run_cmd(check)


if __name__ == "__main__":
    main()
