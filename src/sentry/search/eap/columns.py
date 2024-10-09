from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Literal

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeAggregation, AttributeKey

from sentry.search.eap import constants


@dataclass(frozen=True)
class ResolvedColumn:
    # The alias for this column
    public_alias: str  # `p95() as foo` has the public alias `foo` and `p95()` has the public alias `p95()`
    # The internal rpc alias for this column
    internal_name: str
    # The public type for this column
    search_type: Literal["string", "number", "duration"]
    # Processor is the function run in the post process step to transform a row into the final result
    processor: Callable[[Any], Any] | None = None
    # Validator to check if the value in a query is correct
    validator: Callable[[Any], bool] | None = None

    def process_column(row: Any) -> None:
        """Pull the column from row, then process it and mutate it"""
        raise NotImplementedError()

    def validate(self, value: Any) -> None:
        if self.validator is not None:
            self.validator(value)

    @property
    def proto_definition(self) -> AttributeAggregation | AttributeKey:
        """The definition of this function as needed by the RPC"""
        # Placeholder to implement search for now
        return AttributeKey(name=self.internal_name, type=constants.TYPE_MAP[self.search_type])


# Temporary, just doing enough of these for now so I can write some tests for resolve_query
SPAN_COLUMN_DEFINITIONS = {
    "id": ResolvedColumn(
        public_alias="id",
        internal_name="span_id",
        search_type="string",
    ),
    "organization.id": ResolvedColumn(
        public_alias="organization.id", internal_name="organization_id", search_type="string"
    ),
    "span.action": ResolvedColumn(
        public_alias="span.action",
        internal_name="action",
        search_type="string",
    ),
    "span.description": ResolvedColumn(
        public_alias="span.description",
        internal_name="name",
        search_type="string",
    ),
    "span.op": ResolvedColumn(public_alias="span.op", internal_name="op", search_type="string"),
    "ai.total_tokens.used": ResolvedColumn(
        public_alias="ai.total_tokens.used",
        internal_name="ai_total_tokens_used",
        search_type="number",
    ),
}


Processors: dict[str, Callable[[Any], Any]] = {}
