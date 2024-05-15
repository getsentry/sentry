from sentry.snuba.dataset import EntityKey


class MetricOp:
    def __init__(
        self,
        entity_key: EntityKey,
        name: str,
        snuba_fn: str,
        operation_class: str = "",
        default_aggregate: int | float | None = None,
    ):
        self.entity_key = entity_key
        self.name = name
        self.snuba_fn = snuba_fn
        self.operation_class = operation_class
        self.default_aggregate = default_aggregate
