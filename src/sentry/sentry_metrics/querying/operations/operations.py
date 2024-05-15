from dataclasses import dataclass, field

from sentry.sentry_metrics.querying.operations.operation import MetricOp
from sentry.snuba.dataset import EntityKey


@dataclass
class MetricsOperationsConfig:
    """
    Use as Singleton?
        operations = operations_config[entity_type].as_list()
        operations_config.enable(metric_operation)

    Configure as
        operations_config = MetricsOperationsConfig().enable_percentiles()
    """

    operations: list[MetricOp] = field(default_factory=list)
    enabled_classes: list[str] = field(default_factory=lambda: ["general"])

    def register(self, operation: MetricOp):
        self.operations.append(operation)

    def enable_class(self, operation_class: str):
        if operation_class not in self.enabled_classes:
            self.enabled_classes.append(operation_class)

    def disable_class(self, operation_class: str):
        if operation_class in self.enabled_classes:
            self.enabled_classes.remove(operation_class)

    def get_available_operations_for_entity_key(self, entity_key: EntityKey) -> list[MetricOp]:
        operations = self._get_enabled_operations_for_entity_key(entity_key)
        return [op for op in operations]

    def get_operation_for_entity_key(self, entity_key: EntityKey, operation_name: str) -> MetricOp:

        operations = [
            x for x in self.operations if x.entity_key == entity_key and x.name == operation_name
        ]
        if len(operations) > 0:
            return operations[0]

    def get_available_operation_names_for_entity_key(self, entity_key: EntityKey) -> list[str]:
        return [op.name for op in self._get_enabled_operations_for_entity_key(entity_key)]

    def get_all_available_operation_names(self) -> list[str]:
        return [
            operation.name
            for operation in self.operations
            if operation.operation_class in self.enabled_classes
        ]

    def _get_enabled_operations_for_entity_key(self, entity_key: EntityKey) -> list[MetricOp]:
        return [
            operation
            for operation in self.operations
            if operation.entity_key == entity_key
            and operation.operation_class in self.enabled_classes
        ]

    def get_operations_for_class(self, entity_key: EntityKey, operation_class: str) -> list[str]:
        return [
            operation.name
            for operation in self._get_enabled_operations_for_entity_key(entity_key)
            if operation.operation_class == operation_class
        ]

    def get_op_to_entity_mapping(self) -> dict[str, str]:
        return {
            operation.name: operation.entity_key.name
            for operation in self.operations
            if operation.operation_class in self.enabled_classes
        }
