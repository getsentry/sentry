from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import IntEnum, StrEnum
from typing import TYPE_CHECKING, Any, ClassVar, Generic, TypedDict, TypeVar

from sentry.types.group import PriorityLevel

if TYPE_CHECKING:
    from sentry.deletions.base import ModelRelation
    from sentry.eventstream.base import GroupState
    from sentry.issues.issue_occurrence import IssueOccurrence
    from sentry.issues.status_change_message import StatusChangeMessage
    from sentry.models.activity import Activity
    from sentry.models.environment import Environment
    from sentry.models.group import Group
    from sentry.models.organization import Organization
    from sentry.notifications.models.notificationaction import ActionTarget
    from sentry.services.eventstore.models import GroupEvent
    from sentry.snuba.models import SnubaQueryEventType
    from sentry.workflow_engine.endpoints.validators.base import BaseDetectorTypeValidator
    from sentry.workflow_engine.handlers.detector import DetectorHandler
    from sentry.workflow_engine.models import Action, Detector
    from sentry.workflow_engine.models.data_condition import Condition

T = TypeVar("T")

ERROR_DETECTOR_NAME = "Error Monitor"


class DetectorException(Exception):
    pass


class DetectorPriorityLevel(IntEnum):
    OK = 0
    LOW = PriorityLevel.LOW
    MEDIUM = PriorityLevel.MEDIUM
    HIGH = PriorityLevel.HIGH


# The unique key used to identify a group within a DataPacket result.
# For DataPackets that don't contain multiple values the key is just None.
# This is stored in 'DetectorState.detector_group_key'
DetectorGroupKey = str | None

DataConditionResult = DetectorPriorityLevel | int | float | bool | None


@dataclass(frozen=True)
class DetectorEvaluationResult:
    # TODO - Should group key live at this level?
    group_key: DetectorGroupKey
    # TODO: Are these actually necessary? We're going to produce the occurrence in the detector, so we probably don't
    # need to know the other results externally
    is_triggered: bool
    priority: DetectorPriorityLevel
    # TODO: This is only temporarily optional. We should always have a value here if returning a result
    result: IssueOccurrence | StatusChangeMessage | None = None
    # Event data to supplement the `IssueOccurrence`, if passed.
    event_data: dict[str, Any] | None = None


@dataclass(frozen=True)
class WorkflowEventData:
    event: GroupEvent | Activity
    group: Group
    group_state: GroupState | None = None
    has_reappeared: bool | None = None
    has_escalated: bool | None = None
    workflow_env: Environment | None = None


class ConfigTransformer(ABC):
    @abstractmethod
    def from_api(self, config: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def to_api(self, config: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError


def action_target_strings(lst: list[ActionTarget]) -> list[str]:
    from sentry.notifications.models.notificationaction import ActionTarget

    action_target_to_string = dict(ActionTarget.as_choices())
    return [action_target_to_string[a] for a in lst]


class TargetTypeConfigTransformer(ConfigTransformer):
    def __init__(self, api_schema: dict[str, Any]):
        from sentry.notifications.models.notificationaction import ActionTarget

        self.api_schema = api_schema
        self.action_target_to_string = dict(ActionTarget.as_choices())
        self.action_target_from_string = {v: k for k, v in self.action_target_to_string.items()}

    def from_api(self, config: dict[str, Any]) -> dict[str, Any]:
        """
        Convert from api_schema format to config_schema format.
        Main transformation: target_type string -> target_type integer enum
        """
        # First validate the input against api_schema
        from sentry.workflow_engine.endpoints.validators.utils import validate_json_schema

        validate_json_schema(config, self.api_schema)

        # Create a copy to avoid mutating the input
        transformed_config = config.copy()

        # Convert target_type from string to ActionTarget enum value
        if "target_type" in transformed_config:
            target_type_str = transformed_config["target_type"]
            transformed_config["target_type"] = self.action_target_from_string[target_type_str]

        return transformed_config

    def to_api(self, config: dict[str, Any]) -> dict[str, Any]:
        """
        Convert from config_schema format to api_schema format.
        Main transformation: target_type integer enum -> target_type string
        """
        # Create a copy to avoid mutating the input
        transformed_config = config.copy()

        # Convert target_type from ActionTarget enum value to string
        if "target_type" in transformed_config:
            target_type_enum = transformed_config["target_type"]
            transformed_config["target_type"] = self.action_target_to_string[target_type_enum]

        return transformed_config


class ActionHandler:
    config_schema: ClassVar[dict[str, Any]]
    data_schema: ClassVar[dict[str, Any]]

    class Group(StrEnum):
        NOTIFICATION = "notification"
        TICKET_CREATION = "ticket_creation"
        OTHER = "other"

    group: ClassVar[Group]

    @staticmethod
    def get_config_transformer() -> ConfigTransformer | None:
        return None

    @staticmethod
    def execute(event_data: WorkflowEventData, action: Action, detector: Detector) -> None:
        # TODO - do we need to pass all of this data to an action?
        raise NotImplementedError


class DataSourceTypeHandler(Generic[T]):
    @staticmethod
    def bulk_get_query_object(data_sources) -> dict[int, T | None]:
        """
        Bulk fetch related data-source models returning a dict of the
        `DataSource.id -> T`.
        """
        raise NotImplementedError

    @staticmethod
    def related_model(instance) -> list[ModelRelation]:
        """
        A list of deletion ModelRelations. The model relation query should map
        the source_id field within the related model to the
        `instance.source_id`.
        """
        raise NotImplementedError

    @staticmethod
    def get_instance_limit(org: Organization) -> int | None:
        """
        Returns the maximum number of instances of this data source type for the organization.
        If None, there is no limit.
        """
        raise NotImplementedError

    @staticmethod
    def get_current_instance_count(org: Organization) -> int:
        """
        Returns the current number of instances of this data source type for the organization.
        Only called if `get_instance_limit` returns a number >0
        """
        raise NotImplementedError


class DataConditionHandler(Generic[T]):
    class Group(StrEnum):
        DETECTOR_TRIGGER = "detector_trigger"
        WORKFLOW_TRIGGER = "workflow_trigger"
        ACTION_FILTER = "action_filter"

    class Subgroup(StrEnum):
        ISSUE_ATTRIBUTES = "issue_attributes"
        FREQUENCY = "frequency"
        EVENT_ATTRIBUTES = "event_attributes"

    group: ClassVar[Group]
    subgroup: ClassVar[Subgroup]
    comparison_json_schema: ClassVar[dict[str, Any]] = {}
    condition_result_schema: ClassVar[dict[str, Any]] = {}

    @staticmethod
    def evaluate_value(value: T, comparison: Any) -> DataConditionResult:
        raise NotImplementedError


class DataConditionType(TypedDict):
    id: int | None
    comparison: int
    type: Condition
    condition_result: DetectorPriorityLevel
    condition_group_id: int


# TODO - Move this to snuba module
class SnubaQueryDataSourceType(TypedDict):
    query_type: int
    dataset: str
    query: str
    aggregate: str
    time_window: float
    resolution: float
    environment: str
    event_types: list[SnubaQueryEventType]


@dataclass(frozen=True)
class DetectorSettings:
    handler: type[DetectorHandler] | None = None
    validator: type[BaseDetectorTypeValidator] | None = None
    config_schema: dict[str, Any] = field(default_factory=dict)
