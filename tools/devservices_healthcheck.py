from __future__ import annotations

import argparse
import logging
import os
import subprocess
import time
from collections.abc import Sequence
from typing import Callable


class HealthcheckError(Exception):
    pass


class HealthCheck:
    id: str
    container_name: str
    check_by_default: bool
    check: Callable[[], None]
    deps: list[str]

    def __init__(self, id, container_name, check_by_default, check=None, deps=None):
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
            raise HealthcheckError(f"Container '{self.container_name}' is not running.")


def check_zookeeper():
    response = subprocess.run(
        ("echo ruok | nc 127.0.0.1 2181"),
        shell=True,
        capture_output=True,
        text=True,
    )
    if response.stdout != "imok":
        raise HealthcheckError(f"Zookeeper is not healthy. Response: {response.stdout}")


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
    "redis": HealthCheck(
        "redis",
        "sentry_redis",
        True,
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
    "symbolicator": HealthCheck(
        "symbolicator",
        "sentry_symbolicator",
        False,
    ),
}


def run_with_retries(cmd: Callable[[], None], retries: int, timeout: int) -> None:
    for retry in range(1, retries + 1):
        try:
            cmd()
        except Exception as e:
            if retry == retries:
                print(f"Command failed, no more retries: {e}")
                raise HealthcheckError(f"Command failed: {e}")
            else:
                print(f"Command failed, retrying in {timeout}s (attempt {retry+1} of {retries})...")
                time.sleep(timeout)
        else:
            return


def get_services_to_check(id: str) -> list[str]:
    if all_service_healthchecks.get(id) is None:
        raise HealthcheckError(f"Service '{id}' does not have a health check")

    checks = []
    hc = all_service_healthchecks[id]
    for dep in hc.deps:
        dep_checks = get_services_to_check(dep)
        for d in dep_checks:
            checks.append(d)
    checks.append(id)
    return checks


def check_health(ids: list[str], retries: int = 3, timeout: int = 5) -> None:
    checks = []
    for id in ids:
        s = get_services_to_check(id)
        checks += s

    # dict.fromkeys is used to remove duplicates while maintaining order
    for name in dict.fromkeys(checks):
        print(f"Checking service {name}")
        hc = all_service_healthchecks[name]
        print(f"Checking '{hc.container_name}' is running...")
        ls = " ".join(list(set(checks)))
        try:
            run_with_retries(hc.check_container, retries, timeout)
        except HealthcheckError:
            raise HealthcheckError(
                f"Container '{hc.container_name}' is not running.\n"
                + f"    Start service: sentry devservices up {hc.id}\n"
                + f"    Restart all services: sentry devservices down {ls} && sentry devservices up {ls}"
            )

        if hc.check is not None:
            print(f"Checking '{hc.container_name}' container health...")
            try:
                run_with_retries(hc.check, retries, timeout)
            except HealthcheckError:
                raise HealthcheckError(
                    f"Container '{hc.container_name}' does not appear to be healthy.\n"
                    + f"    Restart service: sentry devservices down {hc.id} && sentry devservices up {hc.id}\n"
                    + f"    Restart all services: sentry devservices down {ls} && sentry devservices up {ls}"
                )


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--service",
        action="append",
        help="The services you wish to check on. Defaults to all services.",
    )

    logging.basicConfig(level=logging.INFO)

    args = parser.parse_args(argv)
    services = args.service

    healthchecks = services
    if healthchecks is None:
        healthchecks = []
        for k in all_service_healthchecks:
            if all_service_healthchecks[k].check_by_default:
                healthchecks.append(k)

    try:
        check_health(healthchecks)
    except HealthcheckError as e:
        print(e)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
