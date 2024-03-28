import sys
import traceback
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

import click
from django.urls import reverse
from openapi_pydantic import OpenAPI
from openapi_pydantic.util import PydanticSchema, construct_open_api_with_schema_class

from sentry.runner.decorators import configuration
from sentry.utils import json


@click.command()
@click.option(
    "--partial",
    is_flag=True,
    default=False,
    help="Ignore RPC methods that produce errors.",
)
@configuration
def rpcschema(partial: bool) -> None:
    from sentry.services.hybrid_cloud.rpc import (
        RpcMethodSignature,
        list_all_service_method_signatures,
    )

    class NullReturnSpecException(Exception):
        """Indicate that an RPC has a null value as its return model.

        This is temporary. Remove this after reworking the way that we model RPC
        methods that logically return None.
        """

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
            if return_schema is None:
                raise NullReturnSpecException
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

    def create_partial_spec(signatures: Iterable[RpcMethodSignature]) -> dict[str, Any]:
        stable_signatures = []
        for sig in signatures:
            try:
                create_spec([sig])
            except Exception:
                traceback.print_exc()
            else:
                stable_signatures.append(sig)

        return create_spec(stable_signatures)

    all_signatures = list_all_service_method_signatures()
    spec = create_partial_spec(all_signatures) if partial else create_spec(all_signatures)
    json.dump(spec, sys.stdout)
