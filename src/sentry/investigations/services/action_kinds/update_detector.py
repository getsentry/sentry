from __future__ import annotations

from collections import defaultdict
from collections.abc import Collection, Mapping, Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Literal, TypedDict, cast

from django.db import router, transaction
from rest_framework import serializers

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.auth.access import Access
from sentry.db.models.fields.bounded import I32_MAX, I64_MAX
from sentry.incidents.endpoints.serializers.query_subscription import SnubaQuerySerializer
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.metric_issue_detector import (
    TRANSACTION_UPDATES_DISABLED,
    MetricIssueDetectorValidator,
    fetch_snuba_query,
)
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.investigations.contracts import (
    ActionPayloadSerializer,
    StrictCharField,
    StrictFloatField,
    StrictIntegerField,
)
from sentry.investigations.models import InvestigationOrchestrationRun
from sentry.investigations.services.action_kinds.base import (
    ActionInvalid,
    ActionKind,
    ActionStale,
    ApplyContext,
    ApplyFailed,
    CannotApplyReason,
    SettingValue,
)
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.notebooks.contracts import StrictContractSerializer
from sentry.notebooks.models import Notebook, NotebookActionRequest
from sentry.snuba.models import SnubaQuery
from sentry.workflow_engine.endpoints.organization_detector_details import (
    check_metric_detector_allowed,
)
from sentry.workflow_engine.endpoints.organization_detector_index import get_detector_validator
from sentry.workflow_engine.endpoints.serializers.data_condition_serializer import (
    DataConditionSerializer,
)
from sentry.workflow_engine.endpoints.validators.utils import can_edit_detector_with_access
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.detector import DetectorQuerySet
from sentry.workflow_engine.types import DetectorPriorityLevel

if TYPE_CHECKING:
    from sentry.auth.principal import RequestPrincipal

UPDATE_DETECTOR_ACTION = "update_detector"


_DETECTOR_TEXT_LIMITS = {"query": 2_000, "aggregate": 500, "environment": 64}


class DetectorChangesSerializer(StrictContractSerializer):
    """The monitor settings an `update_detector` action can read or change."""

    timeWindowSeconds = StrictIntegerField(required=False, min_value=1, max_value=I32_MAX)
    highThreshold = StrictFloatField(required=False)
    mediumThreshold = StrictFloatField(required=False)
    resolutionThreshold = StrictFloatField(required=False)
    query = StrictCharField(
        required=False, allow_blank=True, max_length=_DETECTOR_TEXT_LIMITS["query"]
    )
    aggregate = StrictCharField(required=False, max_length=_DETECTOR_TEXT_LIMITS["aggregate"])
    environment = StrictCharField(
        required=False, allow_null=True, max_length=_DETECTOR_TEXT_LIMITS["environment"]
    )


class UpdateDetectorActionSerializer(ActionPayloadSerializer):
    detectorId = StrictCharField(max_length=32)
    before = DetectorChangesSerializer()
    changes = DetectorChangesSerializer()

    def validate_detectorId(self, value: str) -> str:
        if not (value.isascii() and value.isdigit()) or int(value) > I64_MAX:
            raise serializers.ValidationError("Must be a numeric ID.")
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        before = attrs["before"]
        changes = attrs["changes"]
        if not changes:
            raise serializers.ValidationError({"changes": "At least one change is required."})
        # before can also hold settings Seer relied on but didn't change, so apply can tell
        # if any of them moved.
        if not set(changes) <= set(before):
            raise serializers.ValidationError("Every change needs its before value.")
        if any(changes[key] == before[key] for key in changes):
            raise serializers.ValidationError({"changes": "Every change must differ from before."})
        return attrs

    @classmethod
    def trim(cls, action: dict[str, Any]) -> dict[str, Any] | None:
        """Drop changes we won't apply: text that's over our limits, or a change to a monitor
        with no current aggregate.

        If no changes are left, the request becomes advice.
        """

        before = action.get("before")
        changes = action.get("changes")
        if (
            not isinstance(before, dict)
            or not isinstance(changes, dict)
            or not set(changes) <= set(before)
        ):
            return action
        dropped = {
            key
            for key, limit in _DETECTOR_TEXT_LIMITS.items()
            for values in (before, changes)
            if key in values
            and (
                values[key] is None
                if key == "aggregate"
                else isinstance(values[key], str) and len(values[key]) > limit
            )
        }
        if not dropped:
            return action
        kept = [key for key in changes if key not in dropped]
        if not kept:
            return None
        return {
            **action,
            "before": {key: value for key, value in before.items() if key not in dropped},
            "changes": {key: changes[key] for key in kept},
        }


_THRESHOLD_RESULTS: dict[
    Literal["highThreshold", "mediumThreshold", "resolutionThreshold"], DetectorPriorityLevel
] = {
    "highThreshold": DetectorPriorityLevel.HIGH,
    "mediumThreshold": DetectorPriorityLevel.MEDIUM,
    "resolutionThreshold": DetectorPriorityLevel.OK,
}
_DATA_SOURCE_KEYS = ("timeWindowSeconds", "query", "aggregate", "environment")


class DetectorChanges(TypedDict, total=False):
    timeWindowSeconds: int
    highThreshold: float
    mediumThreshold: float
    resolutionThreshold: float
    query: str
    aggregate: str
    environment: str | None


class DataSourceBody(TypedDict):
    id: str
    dataset: str
    query: str
    aggregate: str
    timeWindow: int
    environment: str | None
    eventTypes: list[str]
    queryType: int


class ConditionBody(TypedDict):
    id: str
    type: str
    # Only static monitors get here, and their conditions compare against a number.
    comparison: float
    conditionResult: int


class ConditionGroupBody(TypedDict):
    id: int
    logicType: str
    conditions: list[ConditionBody]


class DetectorUpdate(TypedDict, total=False):
    """The body we send to the detector validator."""

    conditionGroup: ConditionGroupBody
    dataSources: list[DataSourceBody]


@dataclass(frozen=True)
class DetectorState:
    """A metric monitor's query and conditions, serialized the way the detector API returns
    them, so we can read current values and build an update from the same data.
    """

    data_source: DataSourceBody
    condition_group: ConditionGroupBody | None

    @classmethod
    def load(cls, detector: Detector, snuba_query: SnubaQuery) -> DetectorState:
        serialized = serialize(snuba_query, serializer=SnubaQuerySerializer())
        # Without a mode the update keeps the stored one. Some span monitors migrated from
        # transactions store a mode the validator no longer accepts.
        del serialized["extrapolationMode"]
        data_source = cast(DataSourceBody, {**serialized, "queryType": snuba_query.type})
        group = detector.workflow_condition_group
        condition_group = (
            ConditionGroupBody(
                id=group.id,
                logicType=group.logic_type,
                conditions=cast(
                    list[ConditionBody],
                    serialize(
                        list(group.conditions.order_by("id")), serializer=DataConditionSerializer()
                    ),
                ),
            )
            if group is not None
            else None
        )
        return cls(data_source=data_source, condition_group=condition_group)

    def values(self) -> dict[str, SettingValue]:
        """The monitor's current settings, keyed like Seer's changes. A threshold is left out
        unless exactly one condition sets it.
        """

        values: dict[str, SettingValue] = {
            "timeWindowSeconds": self.data_source["timeWindow"],
            "query": self.data_source["query"],
            "aggregate": self.data_source["aggregate"],
            "environment": self.data_source["environment"],
        }
        conditions = self.condition_group["conditions"] if self.condition_group else []
        for key, result in _THRESHOLD_RESULTS.items():
            comparisons = [
                condition["comparison"]
                for condition in conditions
                if condition["conditionResult"] == result
            ]
            if len(comparisons) == 1:
                values[key] = comparisons[0]
        return values

    def update(self, changes: DetectorChanges) -> DetectorUpdate:
        """Apply Seer's changes on top of the current settings."""

        update: DetectorUpdate = {}
        thresholds: dict[int, float] = {
            result: changes[key] for key, result in _THRESHOLD_RESULTS.items() if key in changes
        }
        if thresholds:
            # values() has no thresholds without a condition group, so the stale check stops
            # those changes before they get here.
            assert self.condition_group is not None
            # The update deletes conditions we leave out, so send them all.
            update["conditionGroup"] = {
                **self.condition_group,
                "conditions": [
                    {
                        **condition,
                        "comparison": thresholds.get(
                            condition["conditionResult"], condition["comparison"]
                        ),
                    }
                    for condition in self.condition_group["conditions"]
                ],
            }
        if any(key in changes for key in _DATA_SOURCE_KEYS):
            data_source = self.data_source.copy()
            if "timeWindowSeconds" in changes:
                data_source["timeWindow"] = changes["timeWindowSeconds"]
            if "query" in changes:
                data_source["query"] = changes["query"]
            if "aggregate" in changes:
                data_source["aggregate"] = changes["aggregate"]
            if "environment" in changes:
                data_source["environment"] = changes["environment"]
            update["dataSources"] = [data_source]
        return update


def is_dynamic_detector(detector: Detector) -> bool:
    # Saving a dynamic monitor calls Seer's anomaly detection inline, so we leave those alone.
    return detector.config.get("detection_type") == AlertRuleDetectionType.DYNAMIC


def target_detectors(organization_id: int, detector_ids: Collection[int]) -> dict[int, Detector]:
    """The metric detectors with these ids that the detector API would find in this org."""

    return {
        detector.id: detector
        for detector in _metric_detectors(organization_id).filter(id__in=detector_ids)
    }


def _metric_detectors(organization_id: int) -> DetectorQuerySet:
    return (
        Detector.objects.by_organization(organization_id)
        .with_type_filters()
        .filter(type=MetricIssue.slug)
        .select_related("project", "workflow_condition_group")
    )


def source_detector_id(source: Mapping[str, Any]) -> str | None:
    """The monitor an investigation's run started from, if it started from one."""

    detector_id = source.get("detectorId")
    return str(detector_id) if detector_id is not None else None


def detector_cannot_apply_reason(
    detector_id: str,
    *,
    source_detector_id: str | None,
    detector: Detector | None,
    organization: Organization,
    access: Access,
) -> CannotApplyReason | None:
    """Why the viewer can't change `detector_id`, or None if they can. `detector` is what
    target_detectors found for that id.
    """
    if detector_id != source_detector_id:
        return CannotApplyReason.NOT_TARGET_DETECTOR
    if detector is None:
        return CannotApplyReason.DETECTOR_NOT_FOUND
    try:
        check_metric_detector_allowed(detector, organization)
    except ResourceDoesNotExist:
        return CannotApplyReason.DETECTOR_NOT_FOUND
    if not can_edit_detector_with_access(detector, access):
        return CannotApplyReason.PERMISSION_DENIED
    if is_dynamic_detector(detector):
        return CannotApplyReason.DYNAMIC_DETECTOR
    return None


def _detector_not_found() -> ApplyFailed:
    return ApplyFailed(
        {"detail": "This monitor wasn't found.", "code": CannotApplyReason.DETECTOR_NOT_FOUND}
    )


def _action_detector_id(action_request: NotebookActionRequest) -> int:
    # The payload was validated when it arrived, and advice never reaches the kind.
    assert action_request.action_payload is not None
    return int(action_request.action_payload["detectorId"])


class UpdateDetectorAppliedDetails(TypedDict):
    detectorId: str
    detectorName: str
    fields: list[str]


def _error_messages(errors: Mapping[str, Any] | Sequence[Any] | str) -> list[str]:
    """Flatten the detector validator's nested errors."""

    if isinstance(errors, str):
        return [errors]
    values = errors.values() if isinstance(errors, Mapping) else errors
    return [message for value in values for message in _error_messages(value)]


def _validation_messages(
    validator: MetricIssueDetectorValidator,
    detector: Detector,
    snuba_query: SnubaQuery,
    environment: SettingValue,
) -> list[str]:
    # The validator creates environments it doesn't know, like the monitor form does. A
    # suggestion shouldn't add one, so an unknown name is just invalid.
    if (
        environment is not None
        and not Environment.objects.filter(
            organization_id=detector.linked_project.organization_id,
            name=environment,
            projects=detector.linked_project,
        ).exists()
    ):
        return [f"The project has no {environment} environment."]
    if not validator.is_valid():
        return _error_messages(validator.errors)
    # The validator only checks this when it saves, so a dry run has to ask for it.
    data_sources = validator.validated_data.get("data_sources")
    if data_sources and validator.is_editing_transaction_dataset(snuba_query, data_sources[0]):
        return [TRANSACTION_UPDATES_DISABLED]
    return []


class UpdateDetectorKind(ActionKind):
    kind = UPDATE_DETECTOR_ACTION
    payload_serializer = UpdateDetectorActionSerializer

    def cannot_apply_reasons(
        self,
        action_requests: Sequence[NotebookActionRequest],
        *,
        investigations: dict[int, Notebook],
        access: Access,
        user: RequestPrincipal,
    ) -> dict[int, CannotApplyReason | None]:
        source_detector_ids = {
            investigation_id: source_detector_id(source)
            for investigation_id, source in InvestigationOrchestrationRun.objects.filter(
                investigation_id__in={item.notebook_id for item in action_requests}
            ).values_list("investigation_id", "source")
        }
        detector_ids_by_org: dict[int, set[int]] = defaultdict(set)
        for item in action_requests:
            organization_id = investigations[item.notebook_id].organization_id
            detector_ids_by_org[organization_id].add(_action_detector_id(item))
        detectors = {
            (organization_id, detector_id): detector
            for organization_id, detector_ids in detector_ids_by_org.items()
            for detector_id, detector in target_detectors(organization_id, detector_ids).items()
        }

        # Requests often share a detector, and the checks query.
        detector_reasons: dict[tuple[int, str | None, int], CannotApplyReason | None] = {}
        reasons: dict[int, CannotApplyReason | None] = {}
        for item in action_requests:
            detector_id = _action_detector_id(item)
            investigation = investigations[item.notebook_id]
            source_id = source_detector_ids.get(item.notebook_id)
            key = (detector_id, source_id, investigation.organization_id)
            if key not in detector_reasons:
                detector_reasons[key] = detector_cannot_apply_reason(
                    str(detector_id),
                    source_detector_id=source_id,
                    detector=detectors.get((investigation.organization_id, detector_id)),
                    organization=investigation.organization,
                    access=access,
                )
            reasons[item.id] = detector_reasons[key]
        return reasons

    def check(self, context: ApplyContext) -> None:
        self._apply(context, dry_run=True)

    def apply(self, context: ApplyContext) -> UpdateDetectorAppliedDetails:
        return self._apply(context, dry_run=False)

    def _apply(self, context: ApplyContext, *, dry_run: bool) -> UpdateDetectorAppliedDetails:
        action = context.action_request.action_payload
        assert action is not None
        detectors = _metric_detectors(context.investigation.organization_id)
        snuba_queries = SnubaQuery.objects.all()
        if not dry_run:
            # Lock the monitor until we save, so an edit between the stale check and the save
            # isn't lost.
            detectors = detectors.select_for_update(of=("self",))
            snuba_queries = snuba_queries.select_for_update()
        try:
            detector = detectors.get(id=int(action["detectorId"]))
        except Detector.DoesNotExist:
            raise _detector_not_found()
        snuba_query = fetch_snuba_query(detector)
        if snuba_query is None:
            raise _detector_not_found()
        if not dry_run:
            snuba_query = snuba_queries.get(id=snuba_query.id)

        state = DetectorState.load(detector, snuba_query)
        current = state.values()
        moved = {
            key: current.get(key)
            for key, value in action["before"].items()
            if current.get(key) != value
        }
        if moved:
            raise ActionStale(moved)

        changes = action["changes"]
        validator = get_detector_validator(
            context.request,
            detector.linked_project,
            detector.group_type.slug,
            detector,
            partial=True,
            data=state.update(changes),
        )
        assert isinstance(validator, MetricIssueDetectorValidator)
        messages = _validation_messages(
            validator, detector, snuba_query, changes.get("environment")
        )
        if messages:
            raise ActionInvalid(messages)
        if not dry_run:
            try:
                # If the save fails partway, undo the monitor changes it made.
                with transaction.atomic(router.db_for_write(Detector)):
                    validator.save()
            except serializers.ValidationError as error:
                raise ActionInvalid(_error_messages(error.detail))
        return {
            "detectorId": str(detector.id),
            "detectorName": detector.name,
            "fields": [key for key in DetectorChangesSerializer().fields.keys() if key in changes],
        }
