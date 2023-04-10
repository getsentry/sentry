#!/usr/bin/python3

import json  # noqa
import re
from typing import Mapping

import click

"""Convenience script for setting up silos in a dev environment.

Prints devserver commands with the necessary environment variables.
"""


def format_env_var(name: str, value: str) -> str:
    value = re.sub("([\"$'\\\\])", "\\\\\\1", value)  # 🤯
    return f'{name}="{value}"'


def format_env_vars(env_vars: Mapping[str, str]) -> str:
    return ";".join(format_env_var(name, value) for (name, value) in env_vars.items())


@click.command()
@click.option(
    "--api-token",
    type=str,
    required=True,
    help=(
        """An API token to authorize RPC requests between servers.

        At the time this script is being written, the authentication system for RPCs
        hasn't been developed. An API token is needed to ensure that an incoming
        request hits a REST endpoint, but it doesn't need to have any particular
        permission scope.

        Because dev instances of the control and region silo will presumably share a
        single database, this script assumes that the same API token will work for both.
        """
    ),
)
@click.option("--control-port", type=int, default=8001, help="Port on which bind the control silo")
@click.option("--region-port", type=int, default=8002, help="Port on which bind the region silo")
def main(api_token: str, control_port: int, region_port: int) -> None:
    region_config = {
        "name": "dev_region",
        "id": 1,
        "address": f"http://localhost:{region_port}/",
        "category": "MULTI_TENANT",
        "api_token": api_token,
    }
    sender_credentials = {
        "is_allowed": True,
        "control_silo_api_token": api_token,
        "control_silo_address": f"http://localhost:{control_port}/",
    }

    common_env_vars = {}
    common_env_vars["SENTRY_REGION_CONFIG"] = json.dumps([region_config])
    common_env_vars["SENTRY_DEV_HYBRID_CLOUD_RPC_SENDER"] = json.dumps(sender_credentials)

    control_env_vars = common_env_vars.copy()
    control_env_vars["SENTRY_SILO_MODE"] = "CONTROL"
    control_env_vars["SENTRY_DEVSERVER_BIND"] = f"localhost:{control_port}"

    region_env_vars = common_env_vars.copy()
    region_env_vars["SENTRY_SILO_MODE"] = "REGION"
    region_env_vars["SENTRY_REGION"] = region_config["name"]
    region_env_vars["SENTRY_DEVSERVER_BIND"] = f"localhost:{region_port}"

    print(f"{format_env_vars(control_env_vars)}; sentry devserver")  # noqa
    print(f"{format_env_vars(region_env_vars)}; sentry devserver")  # noqa


main()
