from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Literal

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    VirtualColumnContext,
)

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap import constants
from sentry.search.events.types import SnubaParams
from sentry.utils.validators import is_event_id, is_span_id


@dataclass(frozen=True)
class ResolvedColumn:
    # The alias for this column
    public_alias: str  # `p95() as foo` -> `foo` or `p95()` -> `p95()`
    # The internal rpc alias for this column
    rpc_name: str
    # The public type for this column
    search_type: Literal["string", "number", "duration"]
    # The internal rpc type for this column, optional as it can mostly be inferred from search_type
    rpc_type: AttributeKey.Type.ValueType | None = None
    # Processor is the function run in the post process step to transform data into the final result
    processor: Callable[[Any], Any] | None = None
    # Validator to check if the value in a query is correct
    validator: Callable[[Any], None] | None = None

    def process_column(row: Any) -> None:
        """Pull the column from row, then process it and mutate it"""
        pass

    def validate(self, value: Any) -> None:
        if self.validator is not None:
            if not self.validator(value):
                raise InvalidSearchQuery(f"{value} is an invalid value for {self.public_alias}")

    @property
    def proto_definition(self) -> AttributeAggregation | AttributeKey:
        """The definition of this function as needed by the RPC"""
        # Placeholder to implement search for now
        return AttributeKey(
            name=self.rpc_name,
            type=self.rpc_type
            if self.rpc_type is not None
            else constants.TYPE_MAP[self.search_type],
        )


SPAN_COLUMN_DEFINITIONS = {
    column.public_alias: column
    for column in [
        ResolvedColumn(
            public_alias="id",
            rpc_name="span_id",
            search_type="string",
            validator=is_span_id,
        ),
        ResolvedColumn(
            public_alias="organization.id", rpc_name="organization_id", search_type="string"
        ),
        ResolvedColumn(
            public_alias="span.action",
            rpc_name="action",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="span.description",
            rpc_name="name",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="description",
            rpc_name="name",
            search_type="string",
        ),
        # Message maps to description, this is to allow wildcard searching
        ResolvedColumn(
            public_alias="message",
            rpc_name="name",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="span.domain", rpc_name="attr_str[domain]", search_type="string"
        ),
        ResolvedColumn(public_alias="span.group", rpc_name="attr_str[group]", search_type="string"),
        ResolvedColumn(public_alias="span.op", rpc_name="attr_str[op]", search_type="string"),
        ResolvedColumn(
            public_alias="span.category", rpc_name="attr_str[category]", search_type="string"
        ),
        ResolvedColumn(
            public_alias="span.self_time", rpc_name="exclusive_time_ms", search_type="duration"
        ),
        ResolvedColumn(
            public_alias="span.status", rpc_name="attr_str[status]", search_type="string"
        ),
        ResolvedColumn(
            public_alias="trace", rpc_name="trace_id", search_type="string", validator=is_event_id
        ),
        ResolvedColumn(
            public_alias="messaging.destination.name",
            rpc_name="attr_str[messaging.destination.name]",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="messaging.message.id",
            rpc_name="attr_str[messaging.message.id]",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="span.status_code", rpc_name="attr_str[status_code]", search_type="string"
        ),
        ResolvedColumn(
            public_alias="replay.id", rpc_name="attr_str[replay_id]", search_type="string"
        ),
        ResolvedColumn(
            public_alias="span.ai.pipeline.group",
            rpc_name="attr_str[ai_pipeline_group]",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="trace.status", rpc_name="attr_str[trace.status]", search_type="string"
        ),
        ResolvedColumn(
            public_alias="browser.name", rpc_name="attr_str[browser.name]", search_type="string"
        ),
        ResolvedColumn(
            public_alias="ai.total_cost",
            rpc_name="attr_num[ai.total_cost]",
            search_type="number",
        ),
        ResolvedColumn(
            public_alias="ai.total_tokens.used",
            rpc_name="attr_num[ai_total_tokens_used]",
            search_type="number",
        ),
        ResolvedColumn(
            public_alias="project",
            rpc_name="project_id",
            rpc_type=constants.INT,
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="project.slug",
            rpc_name="project_id",
            search_type="string",
            rpc_type=constants.INT,
        ),
    ]
}


def project_context_constructor(column_name: str) -> Callable[[SnubaParams], VirtualColumnContext]:
    def context_constructor(params: SnubaParams) -> VirtualColumnContext:
        return VirtualColumnContext(
            from_column_name="project_id",
            to_column_name=column_name,
            value_map={
                str(project_id): project_name
                for project_id, project_name in params.project_id_map.items()
            },
        )

    return context_constructor


VIRTUAL_CONTEXTS = {
    "project": project_context_constructor("project"),
    "project.slug": project_context_constructor("project.slug"),
}


Processors: dict[str, Callable[[Any], Any]] = {}
