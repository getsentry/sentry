from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeAggregation, AttributeKey


class SearchResolverConfig:
    # Automatically add id, etc. if there are no aggregates
    auto_fields: bool = False
    # Ignore aggregate conditions, if false the query will run but not use any aggregate conditions
    use_aggregate_conditions: bool = True
    # TODO: do we need parser_config_overrides? it looks like its just for alerts
    # Whether to process the results from snuba
    process_results: bool = True


@dataclass(frozen=True)
class ResolvedColumn:
    # The alias for this column
    snuba_alias: str  # `p95() as foo` -> `foo` or `p95()` -> `p95()`
    # The definition of this function as needed by the RPC
    proto_definition: AttributeAggregation | AttributeKey
    # Processor is the function run in the post process step to transform data into the final result
    processor: Callable[[Any], Any] | None = None
    # Validator to check if the value in a query is correct
    validator: Callable[[Any], None] | None = None

    def process_column(row: Any) -> None:
        """Pull the column from row, then process it and mutate it"""
        pass

    def validate(self, value: Any) -> None:
        if self.validator is not None:
            self.validator(value)
