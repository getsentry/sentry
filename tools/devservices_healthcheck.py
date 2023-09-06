from __future__ import annotations

import argparse
import os
import subprocess
import time
from collections.abc import Sequence
from typing import Callable


class HealthCheck:
    id: str
    container_name: str
    check_by_default: bool
    check: Callable[[], None]
    deps: list[str]

    def __init__(self, id, container_name, check_by_default, check, deps=None):
        self.id = id
        self.container_name = container_name
        self.check_by_default = check_by_default
        self.check = check
        self.deps = deps or []

    def check_container(self):
        response = subprocess.run(
            ("docker", "container", "inspect", "-f", "'{{.State.Status}}'", self.container_name),
            capture_output=True,
            text=True,
        )
        if response.stdout.strip() != "'running'":
            raise SystemError(
                f"Container '{self.container_name}' is not running. Try 'sentry devservices up {self.id}' to start it"
            )


def check_zookeeper():
    ruok = subprocess.Popen(("echo", "ruok"), stdout=subprocess.PIPE)
    response = subprocess.run(
        ("nc", "127.0.0.1", "2181"),
        stdin=ruok.stdout,
        capture_output=True,
        text=True,
    )
    if response.stdout != "imok":
        raise SystemError(f"Zookeeper is not healthy. Response: {response.stdout}")


def check_kafka():
    # sentry_zookeeper:2181 doesn't work in CI, but 127.0.0.1 doesn't work locally
    zookeeper_origin = "sentry_zookeeper"
    # if os.getenv("CI") == "true":
    #     zookeeper_origin = "127.0.0.1"

    subprocess.run(
        (
            "docker",
            "exec",
            "sentry_kafka",
            "kafka-topics",
            "--zookeeper",
            f"{zookeeper_origin}:2181",
            "--list",
        ),
        check=True,
    )


# Available health checks
all_service_healthchecks = {
    "postgres": HealthCheck(
        "postgres",
        "sentry_postgres",
        True,
        lambda: subprocess.run(
            ["docker", "exec", "sentry_postgres", "pg_isready", "-U", "postgres"], check=True
        ),
    ),
    "kafka": HealthCheck(
        "kafka",
        "sentry_kafka",
        os.getenv("NEED_KAFKA") == "true",
        check_kafka,
        deps=["zookeeper"],
    ),
    "zookeeper": HealthCheck(
        "zookeeper",
        "sentry_zookeeper",
        os.getenv("NEED_KAFKA") == "true",
        check_zookeeper,
    ),
}


def run_with_retries(cmd: Callable[[], None], retries: int = 3, timeout: int = 5) -> None:
    for retry in range(1, retries + 1):
        try:
            cmd()
        except Exception as e:
            if retry == retries:
                print(e)
            else:
                print(f"Command failed, retrying in {timeout}s (attempt {retry+1} of {retries})...")
                time.sleep(timeout)
        else:
            return

    raise SystemExit(1)


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--service",
        action="append",
        help="The services you wish to check on. Defaults to all services.",
    )

    args = parser.parse_args(argv)
    services = args.service

    print(f"Checking services: {services}")

    healthchecks = []
    for k in all_service_healthchecks:
        s = all_service_healthchecks[k]
        check = False
        if services is None:
            check = s.check_by_default
        else:
            check = k in services

        if not check:
            continue

        for dep in s.deps:
            healthchecks.append(all_service_healthchecks[dep])
        healthchecks.append(s)

    for hc in healthchecks:
        print(f"Checking {hc.container_name} is running...")
        run_with_retries(hc.check_container)

        print(f"Checking {hc.container_name} container health...")
        run_with_retries(hc.check)


if __name__ == "__main__":
    main()
