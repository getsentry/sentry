from contextlib import contextmanager

import sentry_sdk_alpha
from sentry_sdk_alpha.consts import OP
from sentry_sdk_alpha.integrations import _check_minimum_version, DidNotEnable, Integration
from sentry_sdk_alpha.scope import should_send_default_pii
from sentry_sdk_alpha.utils import (
    capture_internal_exceptions,
    ensure_integration_enabled,
    event_from_exception,
    package_version,
)

try:
    from graphene.types import schema as graphene_schema  # type: ignore
except ImportError:
    raise DidNotEnable("graphene is not installed")

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Generator
    from typing import Any, Dict, Union
    from graphene.language.source import Source  # type: ignore
    from graphql.execution import ExecutionResult
    from graphql.type import GraphQLSchema
    from sentry_sdk_alpha._types import Event


class GrapheneIntegration(Integration):
    identifier = "graphene"

    @staticmethod
    def setup_once():
        # type: () -> None
        version = package_version("graphene")
        _check_minimum_version(GrapheneIntegration, version)

        _patch_graphql()


def _patch_graphql():
    # type: () -> None
    old_graphql_sync = graphene_schema.graphql_sync
    old_graphql_async = graphene_schema.graphql

    @ensure_integration_enabled(GrapheneIntegration, old_graphql_sync)
    def _sentry_patched_graphql_sync(schema, source, *args, **kwargs):
        # type: (GraphQLSchema, Union[str, Source], Any, Any) -> ExecutionResult
        scope = sentry_sdk_alpha.get_isolation_scope()
        scope.add_event_processor(_event_processor)

        with graphql_span(schema, source, kwargs):
            result = old_graphql_sync(schema, source, *args, **kwargs)

        with capture_internal_exceptions():
            client = sentry_sdk_alpha.get_client()
            for error in result.errors or []:
                event, hint = event_from_exception(
                    error,
                    client_options=client.options,
                    mechanism={
                        "type": GrapheneIntegration.identifier,
                        "handled": False,
                    },
                )
                sentry_sdk_alpha.capture_event(event, hint=hint)

        return result

    async def _sentry_patched_graphql_async(schema, source, *args, **kwargs):
        # type: (GraphQLSchema, Union[str, Source], Any, Any) -> ExecutionResult
        integration = sentry_sdk_alpha.get_client().get_integration(GrapheneIntegration)
        if integration is None:
            return await old_graphql_async(schema, source, *args, **kwargs)

        scope = sentry_sdk_alpha.get_isolation_scope()
        scope.add_event_processor(_event_processor)

        with graphql_span(schema, source, kwargs):
            result = await old_graphql_async(schema, source, *args, **kwargs)

        with capture_internal_exceptions():
            client = sentry_sdk_alpha.get_client()
            for error in result.errors or []:
                event, hint = event_from_exception(
                    error,
                    client_options=client.options,
                    mechanism={
                        "type": GrapheneIntegration.identifier,
                        "handled": False,
                    },
                )
                sentry_sdk_alpha.capture_event(event, hint=hint)

        return result

    graphene_schema.graphql_sync = _sentry_patched_graphql_sync
    graphene_schema.graphql = _sentry_patched_graphql_async


def _event_processor(event, hint):
    # type: (Event, Dict[str, Any]) -> Event
    if should_send_default_pii():
        request_info = event.setdefault("request", {})
        request_info["api_target"] = "graphql"

    elif event.get("request", {}).get("data"):
        del event["request"]["data"]

    return event


@contextmanager
def graphql_span(schema, source, kwargs):
    # type: (GraphQLSchema, Union[str, Source], Dict[str, Any]) -> Generator[None, None, None]
    operation_name = kwargs.get("operation_name")

    operation_type = "query"
    op = OP.GRAPHQL_QUERY
    if source.strip().startswith("mutation"):
        operation_type = "mutation"
        op = OP.GRAPHQL_MUTATION
    elif source.strip().startswith("subscription"):
        operation_type = "subscription"
        op = OP.GRAPHQL_SUBSCRIPTION

    sentry_sdk_alpha.add_breadcrumb(
        crumb={
            "data": {
                "operation_name": operation_name,
                "operation_type": operation_type,
            },
            "category": "graphql.operation",
        },
    )

    with sentry_sdk_alpha.start_span(
        op=op, name=operation_name, only_if_parent=True
    ) as graphql_span:
        graphql_span.set_attribute("graphql.document", source)
        graphql_span.set_attribute("graphql.operation.name", operation_name)
        graphql_span.set_attribute("graphql.operation.type", operation_type)
        yield
