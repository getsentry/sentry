import sys
import traceback
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

import click
from django.urls import reverse

from sentry.runner.decorators import configuration
from sentry.utils import json


@click.command()
@click.option(
    "--partial",
    is_flag=True,
    default=False,
    help="Ignore RPC methods that produce errors.",
)
@click.option(
    "--diagnose",
    is_flag=True,
    default=False,
    help="List RPC methods that produce errors and suppress all other output.",
)
@click.option(
    "--canned",
    required=False,
    type=str,
    help="Produce canned output without interacting with Sentry code.",
)
@configuration
def rpcschema(canned: str, diagnose: bool, partial: bool) -> None:
    if False and canned:
        try:
            output = _CANNED_OUTPUT[canned]
        except KeyError:
            raise ValueError(
                f"Not a valid label for canned output ({canned!r}); "
                f"must be one of: {list(_CANNED_OUTPUT.keys())}"
            )
        json.dump(output, sys.stdout)
        return

    from openapi_pydantic import OpenAPI
    from openapi_pydantic.util import PydanticSchema, construct_open_api_with_schema_class

    from sentry.services.hybrid_cloud.rpc import (
        RpcMethodSignature,
        list_all_service_method_signatures,
    )

    @dataclass
    class RpcSchemaEntry:
        sig: RpcMethodSignature

        @property
        def api_path(self) -> str:
            return reverse(
                "sentry-api-0-rpc-service", args=(self.sig.service_key, self.sig.method_name)
            )

        def build_api_entry(self) -> dict[str, Any]:
            param_schema, return_schema = self.sig.dump_schemas()
            return {
                "post": {
                    "description": "Execute an RPC",
                    "requestBody": {
                        "content": {
                            "application/json": {
                                "schema": PydanticSchema(schema_class=param_schema)
                            }
                        },
                    },
                    "responses": {
                        "200": {
                            "description": "Success",
                            "content": {
                                "application/json": {
                                    "schema": PydanticSchema(schema_class=return_schema)
                                }
                            },
                        }
                    },
                }
            }

    def create_spec(signatures: Iterable[RpcMethodSignature]) -> dict[str, Any]:
        entries = [RpcSchemaEntry(sig) for sig in signatures]
        path_dict = {entry.api_path: entry.build_api_entry() for entry in entries}

        spec = OpenAPI.parse_obj(
            dict(
                info=dict(
                    title="Sentry Internal RPC APIs",
                    version="0.0.1",
                ),
                servers=[dict(url="https://sentry.io/")],  # TODO: Generify with setting value
                paths=path_dict,
            )
        )
        spec = construct_open_api_with_schema_class(spec)
        return spec.dict(by_alias=True, exclude_none=True)

    def create_partial_spec(
        signatures: Iterable[RpcMethodSignature],
    ) -> tuple[dict[str, Any], list[str]]:
        stable_signatures: list[RpcMethodSignature] = []
        error_reports: list[str] = []
        for sig in signatures:
            try:
                create_spec([sig])
            except Exception as e:
                last_line = str(e).split("\n")[-1].strip()
                error_reports.append(f"{sig!s}: {last_line}")
                if not diagnose:
                    traceback.print_exc()
            else:
                stable_signatures.append(sig)

        return create_spec(stable_signatures), error_reports

    all_signatures = list_all_service_method_signatures()

    if diagnose or partial:
        spec, error_reports = create_partial_spec(all_signatures)
        if diagnose:
            print(f"Error count: {len(error_reports)}")  # noqa
            for bad_sig in error_reports:
                print("- " + bad_sig)  # noqa
    else:
        spec = create_spec(all_signatures)

    if not diagnose:
        json.dump(spec, sys.stdout)


_CANNED_OUTPUT = {
    "1": {},
    "2": {},
}
