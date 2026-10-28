from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.handlers.condition.event_frequency_query_handlers import (
    BaseEventFrequencyQueryHandler,
    QueryFilter,
    slow_condition_query_handler_registry,
)
from sentry.workflow_engine.models import DataCondition
from sentry.workflow_engine.models.data_condition import (
    PERCENT_CONDITIONS,
    SLOW_CONDITIONS,
    Condition,
)
from sentry.workflow_engine.utils import log_context

logger = log_context.get_logger("sentry.workflow_engine.processors.delayed_workflow")


@dataclass(frozen=True)
class UniqueConditionQuery:
    """
    Represents all the data that uniquely identifies a condition and its
    single respective Snuba query that must be made. Multiple instances of the
    same condition can share a single query.
    """

    handler: type[BaseEventFrequencyQueryHandler]
    interval: str
    environment_id: int | None
    comparison_interval: str | None = None
    # Hashable representation of the filters
    frozen_filters: Sequence[frozenset[tuple[str, Any]]] | None = None

    @staticmethod
    def freeze_filters(
        filters: Sequence[Mapping[str, Any]] | None,
    ) -> Sequence[frozenset[tuple[str, Any]]] | None:
        """
        Convert the sorted representation of filters into a frozen one that can
        be safely hashed.
        """
        if filters is None:
            return None
        return tuple(frozenset(sorted(filter.items())) for filter in filters)

    @property
    def filters(self) -> list[QueryFilter] | None:
        if self.frozen_filters is None:
            return None
        return [dict(filter) for filter in self.frozen_filters]

    def __repr__(self) -> str:
        return f"UniqueConditionQuery(handler={self.handler.__name__}, interval={self.interval}, environment_id={self.environment_id}, comparison_interval={self.comparison_interval}, filters={self.filters})"


def generate_unique_queries(
    condition: DataCondition, environment_id: int | None
) -> list[UniqueConditionQuery]:
    """
    Returns a list of all unique condition queries that must be made for the
    given condition instance.
    Count comparison conditions will only have one unique query, while percent
    comparison conditions will have two unique queries.
    """

    try:
        condition_type = Condition(condition.type)
    except ValueError:
        logger.exception(
            "Invalid condition type",
            extra={"type": condition.type, "id": condition.id},
        )
        return []

    if condition_type not in SLOW_CONDITIONS:
        return []

    try:
        handler = slow_condition_query_handler_registry.get(condition_type)
    except NoRegistrationExistsError:
        logger.exception(
            "No registration exists for condition",
            extra={"type": condition.type, "id": condition.id},
        )
        return []

    unique_queries = [
        UniqueConditionQuery(
            handler=handler,
            interval=condition.comparison["interval"],
            environment_id=environment_id,
            frozen_filters=UniqueConditionQuery.freeze_filters(condition.comparison.get("filters")),
        )
    ]
    if condition_type in PERCENT_CONDITIONS:
        unique_queries.append(
            UniqueConditionQuery(
                handler=handler,
                interval=condition.comparison["interval"],
                environment_id=environment_id,
                comparison_interval=condition.comparison.get("comparison_interval"),
                frozen_filters=UniqueConditionQuery.freeze_filters(
                    condition.comparison.get("filters")
                ),
            )
        )
    return unique_queries
