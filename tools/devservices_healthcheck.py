from __future__ import annotations

import argparse
import os
import subprocess
import time
from collections.abc import Sequence
from typing import Callable


class HealthcheckError(Exception):
    pass


class HealthCheck:
    def __init__(
        self,
        service_id: str,
        container_name: str,
        check_by_default: bool,
        check: Callable[[], object] | None = None,
        deps: list[str] | None = None,
        retries: int = 3,
        timeout_secs: int = 5,
    ):
        self.service_id = service_id
        self.container_name = container_name
        self.check_by_default = check_by_default
        self.check = check
        self.deps = deps or []
        self.retries = retries
        self.timeout_secs = timeout_secs

    def check_container(self) -> None:
        response = subprocess.run(
            ("docker", "container", "inspect", "-f", "{{.State.Status}}", self.container_name),
            capture_output=True,
            text=True,
        )
        if response.stdout.strip() != "running":
            raise HealthcheckError(f"Container '{self.container_name}' is not running.")


def check_kafka():
    subprocess.run(
        (
            "docker",
            "exec",
            "sentry_kafka",
            "kafka-topics",
            "--bootstrap-server",
            "127.0.0.1:9092",
            "--list",
        ),
        check=True,
    )


def check_postgres() -> None:
    subprocess.run(
        ("docker", "exec", "sentry_postgres", "pg_isready", "-U", "postgres"), check=True
    )


# Available health checks
all_service_healthchecks = {
    "postgres": HealthCheck(
        "postgres",
        "sentry_postgres",
        True,
        check_postgres,
    ),
    "kafka": HealthCheck(
        "kafka",
        "sentry_kafka",
        os.getenv("NEED_KAFKA") == "true",
        check_kafka,
    ),
}


def run_with_retries(cmd: Callable[[], object], retries: int, timeout: int) -> None:
    for retry in range(1, retries + 1):
        try:
            cmd()
        except (HealthcheckError, subprocess.CalledProcessError) as e:
            if retry == retries:
                print(f"Command failed, no more retries: {e}")
                raise HealthcheckError(f"Command failed: {e}")
            else:
                print(f"Command failed, retrying in {timeout}s (attempt {retry+1} of {retries})...")
                time.sleep(timeout)
        else:
            return


def get_services_to_check(id: str) -> list[str]:
    checks = []
    hc = all_service_healthchecks[id]
    for dep in hc.deps:
        dep_checks = get_services_to_check(dep)
        for d in dep_checks:
            checks.append(d)
    checks.append(id)
    return checks


def check_health(service_ids: list[str]) -> None:
    checks = [
        check_id for service_id in service_ids for check_id in get_services_to_check(service_id)
    ]

    # dict.fromkeys is used to remove duplicates while maintaining order
    unique_checks = list(dict.fromkeys(checks))
    for name in unique_checks:
        print(f"Checking service {name}")
        hc = all_service_healthchecks[name]
        print(f"Checking '{hc.container_name}' is running...")
        ls = " ".join(unique_checks)
        try:
            run_with_retries(hc.check_container, hc.retries, hc.timeout_secs)
        except HealthcheckError:
            raise HealthcheckError(
                f"Container '{hc.container_name}' is not running.\n"
                f"    Start service: sentry devservices up {hc.service_id}\n"
                f"    Restart all services: sentry devservices down {ls} && sentry devservices up {ls}"
            )

        if hc.check is not None:
            print(f"Checking '{hc.container_name}' container health...")
            try:
                run_with_retries(hc.check, hc.retries, hc.timeout_secs)
            except HealthcheckError:
                raise HealthcheckError(
                    f"Container '{hc.container_name}' does not appear to be healthy.\n"
                    f"    Restart service: sentry devservices down {hc.service_id} && sentry devservices up {hc.service_id}\n"
                    f"    Restart all services: sentry devservices down {ls} && sentry devservices up {ls}"
                )


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--service",
        action="append",
        choices=list(dict.fromkeys(all_service_healthchecks)),
        help="The services you wish to check on. Defaults to all services.",
    )

    args = parser.parse_args(argv)

    healthchecks = args.service
    if healthchecks is None:
        healthchecks = [k for k, v in all_service_healthchecks.items() if v.check_by_default]

    try:
        check_health(healthchecks)
    except HealthcheckError as e:
        raise SystemExit(e)


if __name__ == "__main__":
    main()
