from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from enum import IntEnum, StrEnum
from logging import Logger
from typing import TYPE_CHECKING, Any, ClassVar, Generic, TypedDict, TypeVar, int

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
    from sentry.services.eventstore.models import GroupEvent
    from sentry.snuba.models import SnubaQueryEventType
    from sentry.workflow_engine.endpoints.validators.base import BaseDetectorTypeValidator
    from sentry.workflow_engine.handlers.detector import DetectorHandler
    from sentry.workflow_engine.models import Action, DataConditionGroup, Detector, Workflow
    from sentry.workflow_engine.models.data_condition import Condition

T = TypeVar("T")

ERROR_DETECTOR_NAME = "Error Monitor"
ISSUE_STREAM_DETECTOR_NAME = "Issue Stream"


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


@dataclass
class WorkflowEvaluationData:
    group_event: GroupEvent | Activity
    action_groups: set[DataConditionGroup] | None = None
    workflows: set[Workflow] | None = None
    triggered_actions: set[Action] | None = None
    triggered_workflows: set[Workflow] | None = None
    associated_detector: Detector | None = None


@dataclass(frozen=True)
class WorkflowEvaluation:
    """
    This is the result of `process_workflows`, and is used to
    encapsulate different stages of completion for the method.

    The `tainted` flag is used to indicate whether or not actions
    have been triggered during the workflows evaluation.

    The `msg` field is used for debug information during the evaluation.

    The `data` attribute will include all the data used to evaluate the
    workflows, and determine if an action should be triggered.
    """

    tainted: bool
    msg: str | None
    data: WorkflowEvaluationData

    def to_log(self, logger: Logger) -> None:
        """
        Determines how far in the process the evaluation got to
        and creates a structured log string to quickly find.

        Then this will return the that log string, and the
        relevant processing data to be logged.
        """
        log_str = "workflow_engine.process_workflows.evaluation"

        if self.tainted:
            if self.data.triggered_workflows is None:
                log_str = f"{log_str}.workflows.not_triggered"
            else:
                log_str = f"{log_str}.workflows.triggered"
        else:
            log_str = f"{log_str}.actions.triggered"

        logger.info(log_str, extra={**asdict(self.data), "debug_msg": self.msg})


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

    @staticmethod
    def execute(event_data: WorkflowEventData, action: Action, detector: Detector) -> None:
        # TODO - do we need to pass all of this data to an action?
        raise NotImplementedError


class DataSourceTypeHandler(ABC, Generic[T]):
    @staticmethod
    @abstractmethod
    def bulk_get_query_object(data_sources) -> dict[int, T | None]:
        """
        Bulk fetch related data-source models returning a dict of the
        `DataSource.id -> T`.
        """
        raise NotImplementedError

    @staticmethod
    @abstractmethod
    def related_model(instance) -> list[ModelRelation]:
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

    @staticmethod
    def evaluate_value(value: T, comparison: Any) -> DataConditionResult:
        """
        Evaluate the value of a data condition.
        Any error that results in a failure to provide a correct result should
        raise a DataConditionEvaluationException.
        """
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
