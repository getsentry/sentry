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
@click.option("--region-count", type=int, default=2, help="Number of region silos")
@click.option(
    "--control-port",
    type=int,
    default=8001,
    help=(
        """Port on which to bind the control silo.

        Region silos will be bound on ascending numbers after this one.
        """
    ),
)
def main(api_token: str, region_count: int, control_port: int) -> None:
    sender_credentials = {
        "is_allowed": True,
        "control_silo_api_token": api_token,
        "control_silo_address": f"http://localhost:{control_port}/",
    }

    region_config = [
        {
            "name": f"devregion{region_number}",
            "id": region_number,
            "address": f"http://localhost:{control_port + region_number}/",
            "category": "MULTI_TENANT",
            "api_token": api_token,
        }
        for region_number in range(1, region_count + 1)
    ]

    common_env_vars = {}
    common_env_vars["SENTRY_REGION_CONFIG"] = json.dumps([region_config])
    common_env_vars["SENTRY_DEV_HYBRID_CLOUD_RPC_SENDER"] = json.dumps(sender_credentials)

    control_env_vars = common_env_vars.copy()
    control_env_vars["SENTRY_SILO_MODE"] = "CONTROL"
    control_env_vars["SENTRY_DEVSERVER_BIND"] = f"localhost:{control_port}"

    print(f"# Control silo\n{format_env_vars(control_env_vars)}; sentry devserver")  # noqa

    for region in region_config:
        region_number = region["id"]
        region_env_vars = common_env_vars.copy()
        region_env_vars["SENTRY_SILO_MODE"] = "REGION"
        region_env_vars["SENTRY_REGION"] = region["name"]
        region_env_vars["SENTRY_DEVSERVER_BIND"] = f"localhost:{control_port + region_number}"

        print(f"\n# {region['name']}\n{format_env_vars(region_env_vars)}; sentry devserver")  # noqa


main()
