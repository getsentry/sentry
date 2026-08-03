from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import IntEnum, StrEnum
from typing import (
    TYPE_CHECKING,
    Any,
    ClassVar,
    Generic,
    Literal,
    Sequence,
    TypeAlias,
    TypedDict,
    TypeVar,
)

from django.db.models import Q

from sentry.types.group import PriorityLevel

if TYPE_CHECKING:
    from sentry.deletions.base import ModelRelation
    from sentry.eventstream.base import GroupState
    from sentry.issues.issue_occurrence import IssueOccurrence
    from sentry.issues.status_change_message import StatusChangeMessage
    from sentry.models.activity import Activity
    from sentry.models.environment import Environment
    from sentry.models.group import Group
    from sentry.models.groupassignee import GroupAssignee
    from sentry.models.organization import Organization
    from sentry.services.eventstore.models import GroupEvent
    from sentry.snuba.dataset import Dataset
    from sentry.snuba.models import ExtrapolationMode, SnubaQuery, SnubaQueryEventType
    from sentry.workflow_engine.endpoints.validators.base import BaseDetectorTypeValidator
    from sentry.workflow_engine.handlers.detector import DetectorHandler
    from sentry.workflow_engine.models import Action, Detector
    from sentry.workflow_engine.models.data_condition import Condition
    from sentry.workflow_engine.models.data_source import DataSource

T = TypeVar("T")

ERROR_DETECTOR_NAME = "Error Monitor"
ISSUE_STREAM_DETECTOR_NAME = "Issue Stream"

ActionId: TypeAlias = int
DataConditionGroupId: TypeAlias = int
DetectorId: TypeAlias = int
GroupId: TypeAlias = int
WorkflowId: TypeAlias = int


class AlertRuleNotDualWritten(Exception):
    pass


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
class ConditionError:
    """
    Represents the failed evaluation of a data condition.
    Not intended to be detailed or comprehensive; code returning this
    is assumed to have already reported the error.

    A message is provided for clarity and to aid in debugging; a singleton placeholder
    value would also work, but would be less clear.
    """

    msg: str


type DetectorResult = IssueOccurrence | StatusChangeMessage | None
type WorkflowEvaluationDeferred = Literal["deferred"]
type WorkflowEvaluationResult = Sequence[Action] | WorkflowEvaluationDeferred


class _WorkflowEventLocalCache(TypedDict, total=False):
    group_assignees: Sequence[GroupAssignee]


@dataclass(frozen=True)
class WorkflowEventData:
    event: GroupEvent | Activity
    group: Group
    group_state: GroupState | None = None
    # True when an issue transitions to the ESCALATING substatus for any reason.
    has_escalated: bool | None = None
    workflow_env: Environment | None = None

    # The cache field is used to deduplicate repeated work within the context
    # of a single event. This field violates the "frozen" requirement of the
    # "WorkflowEventData" type but it enables tightly scoped caching which does
    # not leak across workflow events.
    _cache: _WorkflowEventLocalCache = field(
        default_factory=lambda: _WorkflowEventLocalCache(), repr=False, compare=False, hash=False
    )


@dataclass(frozen=True)
class ActionInvocation:
    """
    Represents a single invocation of a workflow action, containing all the information
    needed to route and execute the action through the appropriate handler.
    """

    event_data: WorkflowEventData
    action: Action
    detector: Detector
    notification_uuid: str
    # The workflow that triggered this action. An action may be associated
    # with multiple workflows; this is an arbitrary choice among them.
    workflow_id: WorkflowId


class ConfigTransformer(ABC):
    """
    A ConfigTransformer is used to transform the config between API and internal representations.
    """

    @abstractmethod
    def from_api(self, config: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def to_api(self, config: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError


class ActionHandler:
    config_schema: ClassVar[dict[str, Any]]
    data_schema: ClassVar[dict[str, Any]]

    class Group(StrEnum):
        NOTIFICATION = "notification"
        TICKET_CREATION = "ticket_creation"
        OTHER = "other"

    group: ClassVar[Group]

    @classmethod
    def get_config_transformer(cls) -> ConfigTransformer | None:
        return None

    @classmethod
    def serialize_data(cls, data: dict[str, Any]) -> dict[str, Any]:
        from sentry.api.serializers.rest_framework.base import (
            convert_dict_key_case,
            snake_to_camel_case,
        )

        return convert_dict_key_case(data, snake_to_camel_case)

    @staticmethod
    def execute(invocation: ActionInvocation) -> None:
        # TODO - do we need to pass all of this data to an action?
        raise NotImplementedError


class DataSourceTypeHandler(ABC, Generic[T]):
    @staticmethod
    @abstractmethod
    def bulk_get_query_object(data_sources: list[DataSource]) -> dict[int, T | None]:
        """
        Bulk fetch related data-source models returning a dict of the
        `DataSource.id -> T`.
        """
        raise NotImplementedError

    @staticmethod
    @abstractmethod
    def related_model(instance: DataSource) -> list[ModelRelation]:
        """
        A list of deletion ModelRelations. The model relation query should map
        the source_id field within the related model to the
        `instance.source_id`.
        """
        raise NotImplementedError

    @staticmethod
    @abstractmethod
    def get_instance_limit(org: Organization) -> int | None:
        """
        Returns the maximum number of instances of this data source type for the organization.
        If None, there is no limit.
        """
        raise NotImplementedError

    @staticmethod
    @abstractmethod
    def get_current_instance_count(org: Organization) -> int:
        """
        Returns the current number of instances of this data source type for the organization.
        Only called if `get_instance_limit` returns a number >0
        """
        raise NotImplementedError

    @staticmethod
    @abstractmethod
    def get_relocation_model_name() -> str:
        """
        Returns the normalized model name (e.g., "sentry.querysubscription") for the model that
        source_id references. This is used during backup/relocation to map old PKs to new PKs.
        The format is "app_label.model_name" in lowercase.
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
    label_template = ""

    @staticmethod
    def evaluate_value(value: T, comparison: Any) -> DataConditionResult:
        """
        Evaluate the value of a data condition.
        Any error that results in a failure to provide a correct result should
        raise a DataConditionEvaluationException.
        """
        raise NotImplementedError

    @classmethod
    def render_label(cls, condition_data: dict[str, Any], organization_id: int) -> str:
        return cls.label_template.format(**condition_data)

    @classmethod
    def validate_comparison(
        cls, comparison: dict[str, Any], organization: Organization
    ) -> dict[str, Any]:
        """
        Validate a comparison value beyond what `comparison_json_schema` can express.
        Runs at save time after schema validation.
        Raise `rest_framework.serializers.ValidationError` to reject.
        """
        return comparison


class DataConditionType(TypedDict):
    id: int | None
    comparison: int
    type: Condition
    condition_result: DetectorPriorityLevel
    condition_group_id: int


# TODO - Move this to snuba module
class SnubaQueryDataSourceType(TypedDict, total=False):
    query_type: SnubaQuery.Type
    dataset: Dataset
    query: str
    aggregate: str
    time_window: float
    resolution: float
    extrapolation_mode: ExtrapolationMode | None
    environment: Environment | None
    event_types: list[SnubaQueryEventType.EventType]


@dataclass(frozen=True)
class DetectorSettings:
    handler: type[DetectorHandler[Any]] | None = None
    validator: type[BaseDetectorTypeValidator] | None = None
    config_schema: dict[str, Any] = field(default_factory=dict)
    filter: Q | None = None


WorkflowActivityHandler: TypeAlias = Callable[["Group", "Activity", DetectorId | None], None]
