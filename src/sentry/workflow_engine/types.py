from __future__ import annotations

import random
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import IntEnum, StrEnum
from logging import Logger
from typing import TYPE_CHECKING, Any, ClassVar, Generic, TypedDict, TypeVar

from django.db.models import Q
from sentry_sdk import logger as sentry_logger

from sentry import features, options
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
    from sentry.workflow_engine.buffer.batch_client import DelayedWorkflowItem
    from sentry.workflow_engine.endpoints.validators.base import BaseDetectorTypeValidator
    from sentry.workflow_engine.handlers.detector import DetectorHandler
    from sentry.workflow_engine.models import Action, DataConditionGroup, Detector, Workflow
    from sentry.workflow_engine.models.action import ActionSnapshot
    from sentry.workflow_engine.models.data_condition import Condition
    from sentry.workflow_engine.models.data_condition_group import DataConditionGroupSnapshot
    from sentry.workflow_engine.models.detector import DetectorSnapshot
    from sentry.workflow_engine.models.workflow import WorkflowSnapshot

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


@dataclass(frozen=True)
class ActionInvocation:
    """
    Represents a single invocation of a workflow action, containing all the information
    needed to route and execute the action through the appropriate handler.
    """

    event_data: WorkflowEventData
    action: Action
    detector: Detector


class WorkflowEvaluationSnapshot(TypedDict):
    """
    A snapshot of data used to evaluate a workflow.
    Ensure that this size is kept smaller, since it's used in logging.
    """

    associated_detector: DetectorSnapshot | None
    event_id: str | None  # ID in NodeStore
    group: Group | None
    workflow_ids: list[int] | None
    triggered_workflows: list[WorkflowSnapshot] | None
    delayed_conditions: list[str] | None
    action_filter_conditions: list[DataConditionGroupSnapshot] | None
    triggered_actions: list[ActionSnapshot] | None


@dataclass
class WorkflowEvaluationData:
    event: GroupEvent | Activity
    organization: Organization
    associated_detector: Detector | None = None
    action_groups: set[DataConditionGroup] | None = None
    workflows: set[Workflow] | None = None
    triggered_workflows: set[Workflow] | None = None
    delayed_conditions: dict[Workflow, DelayedWorkflowItem] | None = None
    triggered_actions: set[Action] | None = None

    def get_snapshot(self) -> WorkflowEvaluationSnapshot:
        """
        This method will take the complex data structures, like models / list of models,
        and turn them into the critical attributes of a model or lists of IDs.
        """

        associated_detector = None
        if self.associated_detector:
            associated_detector = self.associated_detector.get_snapshot()

        workflow_ids = None
        if self.workflows:
            workflow_ids = [workflow.id for workflow in self.workflows]

        triggered_workflows = None
        if self.triggered_workflows:
            triggered_workflows = [workflow.get_snapshot() for workflow in self.triggered_workflows]

        action_filter_conditions = None
        if self.action_groups:
            action_filter_conditions = [group.get_snapshot() for group in self.action_groups]

        triggered_actions = None
        if self.triggered_actions:
            triggered_actions = [action.get_snapshot() for action in self.triggered_actions]

        event_id = None
        if hasattr(self.event, "event_id"):
            event_id = str(self.event.event_id)

        delayed_conditions = None
        if self.delayed_conditions:
            delayed_conditions = [
                delayed_item.buffer_key() for _, delayed_item in self.delayed_conditions.items()
            ]

        return {
            "associated_detector": associated_detector,
            "event_id": event_id,
            "group": self.event.group,
            "workflow_ids": workflow_ids,
            "triggered_workflows": triggered_workflows,
            "delayed_conditions": delayed_conditions,
            "action_filter_conditions": action_filter_conditions,
            "triggered_actions": triggered_actions,
        }


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
    data: WorkflowEvaluationData
    msg: str | None = None

    def log_to(self, logger: Logger) -> bool:
        """
        Logs workflow evaluation data.
        Logging may be skipped if the organization isn't opted in and logs are being
        sampled.
        Returns True if logged, False otherwise.
        """
        # Check if we should log this evaluation
        organization = self.data.organization
        should_log = features.has("organizations:workflow-engine-log-evaluations", organization)
        direct_to_sentry = options.get("workflow_engine.evaluation_logs_direct_to_sentry")

        if not should_log:
            sample_rate = options.get("workflow_engine.evaluation_log_sample_rate")
            should_log = random.random() < sample_rate

        if not should_log:
            return False

        log_str = "workflow_engine.process_workflows.evaluation"

        if self.tainted:
            if self.data.triggered_workflows is None:
                log_str = f"{log_str}.workflows.not_triggered"
            else:
                log_str = f"{log_str}.workflows.triggered"
        else:
            log_str = f"{log_str}.actions.triggered"

        data_snapshot = self.data.get_snapshot()
        detection_type = (
            data_snapshot["associated_detector"]["type"]
            if data_snapshot["associated_detector"]
            else None
        )
        group_id = data_snapshot["group"].id if data_snapshot["group"] else None
        triggered_workflows = data_snapshot["triggered_workflows"] or []
        action_filter_conditions = data_snapshot["action_filter_conditions"] or []
        triggered_actions = data_snapshot["triggered_actions"] or []
        extra = {
            "event_id": data_snapshot["event_id"],
            "group_id": group_id,
            "detection_type": detection_type,
            "workflow_ids": data_snapshot["workflow_ids"],
            "triggered_workflow_ids": [w["id"] for w in triggered_workflows],
            "delayed_conditions": data_snapshot["delayed_conditions"],
            "action_filter_group_ids": [afg["id"] for afg in action_filter_conditions],
            "triggered_action_ids": [a["id"] for a in triggered_actions],
            "debug_msg": self.msg,
        }

        if direct_to_sentry:
            sentry_logger.info(log_str, attributes=extra)
        else:
            logger.info(log_str, extra=extra)
        return True


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
    def execute(invocation: ActionInvocation) -> None:
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
    filter: Q | None = None
