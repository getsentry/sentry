from __future__ import annotations

from collections.abc import Sequence
from datetime import timedelta
from typing import Any

from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from sentry import audit_log
from sentry.constants import ObjectStatus
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.metric_issue_detector import TRANSACTION_UPDATES_DISABLED
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.subscription_limits import METRIC_SUBSCRIPTION_FEATURE_FLAGS
from sentry.investigations.models import (
    InvestigationActionRequest,
    InvestigationActionRequestState,
    InvestigationBlock,
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationCommandStatus,
    InvestigationOrchestrationPhase,
    InvestigationOrchestrationRun,
    InvestigationStatus,
)
from sentry.investigations.services.action_kinds import ACTION_KINDS
from sentry.investigations.services.action_kinds.base import (
    ActionInvalid,
    ActionStale,
    CannotApplyReason,
)
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.environment import Environment
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.seer import agent_token
from sentry.seer.models.run import SeerRunMirrorStatus, SeerRunType
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import ExtrapolationMode, SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_kafka, requires_snuba
from sentry.workflow_engine.models import DataConditionGroup, Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.investigations.services.test_orchestration import (
    BreachedMetricInvestigationTestCase,
)
from tests.sentry.investigations.test_contracts import RecordingKind, fake_action, fake_action_kind
from tests.sentry.investigations.test_seer_contract import fixture

pytestmark = [requires_snuba, requires_kafka]

FEATURE = "organizations:investigations"


@with_feature({FEATURE: True, **METRIC_SUBSCRIPTION_FEATURE_FLAGS})
class OrganizationInvestigationActionRequestApplyTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.environment = self.create_environment(project=self.project, name="production")
        self.detector = self.create_metric_detector()
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Breach"
        )
        self.orchestration_run = self.create_investigation_orchestration_run(
            investigation=self.investigation,
            seer_run=self.create_seer_run(
                organization=self.organization,
                type=SeerRunType.INVESTIGATION,
                seer_run_state_id=4815,
                mirror_status=SeerRunMirrorStatus.LIVE,
            ),
            workflow_version=4,
            phase="completed",
            status="completed",
            source={"type": "breached_metric", "detectorId": str(self.detector.id)},
            projection={"workflowVersion": 4, "report": {"revision": 0, "status": "completed"}},
        )

    def create_metric_detector(
        self,
        *,
        dataset: Dataset = Dataset.Events,
        time_window: int = 300,
        high: float = 500.0,
        conditions: Sequence[tuple[Condition, float, int]] | None = None,
        config: dict[str, Any] | None = None,
    ) -> Detector:
        eap = dataset == Dataset.EventsAnalyticsPlatform
        with self.tasks():
            snuba_query = create_snuba_query(
                query_type=SnubaQuery.Type.PERFORMANCE if eap else SnubaQuery.Type.ERROR,
                dataset=dataset,
                query="span.op:http.client" if eap else "level:error",
                aggregate="count(span.duration)" if eap else "count()",
                time_window=timedelta(seconds=time_window),
                resolution=timedelta(minutes=1),
                environment=self.environment,
                event_types=[
                    SnubaQueryEventType.EventType.TRACE_ITEM_SPAN
                    if eap
                    else SnubaQueryEventType.EventType.ERROR
                ],
                extrapolation_mode=(ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED if eap else None),
            )
            subscription = create_snuba_subscription(
                project=self.project,
                subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=snuba_query,
            )
        group = self.create_data_condition_group(
            organization_id=self.organization.id, logic_type=DataConditionGroup.Type.ANY
        )
        for condition_type, comparison, result in conditions or [
            (Condition.GREATER, high, DetectorPriorityLevel.HIGH),
            (Condition.LESS_OR_EQUAL, high, DetectorPriorityLevel.OK),
        ]:
            self.create_data_condition(
                condition_group=group,
                type=condition_type,
                comparison=comparison,
                condition_result=result,
            )
        detector = self.create_detector(
            project=self.project,
            type=MetricIssue.slug,
            workflow_condition_group=group,
            config=config or {"detection_type": "static"},
        )
        data_source = self.create_data_source(
            organization=self.organization, source_id=subscription.id
        )
        self.create_data_source_detector(data_source=data_source, detector=detector)
        return detector

    def suggest(
        self,
        *,
        before: dict[str, Any] | None = None,
        changes: dict[str, Any] | None = None,
        detector_id: int | None = None,
        **values: Any,
    ) -> InvestigationActionRequest:
        values.setdefault("action_kind", "update_detector")
        values.setdefault(
            "action_payload",
            {
                "kind": "update_detector",
                "detectorId": str(detector_id or self.detector.id),
                "before": before or {"timeWindowSeconds": 300},
                "changes": changes or {"timeWindowSeconds": 900},
            },
        )
        return self.create_investigation_action_request(
            investigation=self.investigation, key="widen-window", **values
        )

    def apply_url(self, action_request_id: int | str, investigation_id: int | None = None) -> str:
        return reverse(
            "sentry-api-0-organization-investigation-action-request-apply",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation_id or self.investigation.id,
                "action_request_id": action_request_id,
            },
        )

    def apply(self, action_request: InvestigationActionRequest, **data: Any) -> Any:
        return self.client.post(self.apply_url(action_request.id), data=data, format="json")

    def snuba_query(self, detector: Detector | None = None) -> SnubaQuery:
        data_source = (detector or self.detector).data_sources.get()
        return SnubaQuery.objects.get(subscriptions__id=int(data_source.source_id))

    def conditions(self) -> dict[int, tuple[int, float]]:
        assert self.detector.workflow_condition_group is not None
        return {
            condition.id: (condition.condition_result, condition.comparison)
            for condition in self.detector.workflow_condition_group.conditions.all()
        }

    def test_applies_a_threshold_change(self) -> None:
        action_request = self.suggest(
            before={"highThreshold": 500}, changes={"highThreshold": 800.0}
        )
        conditions = self.conditions()

        response = self.apply(action_request)

        assert response.status_code == 200, response.data
        assert set(response.data) == {"actionRequest"}
        serialized = response.data["actionRequest"]
        assert serialized["id"] == str(action_request.id)
        assert serialized["state"] == "applied"
        assert serialized["appliedBy"]["id"] == str(self.user.id)
        assert serialized["cannotApplyReason"] == "not_suggested"
        updated = self.conditions()
        assert set(updated) == set(conditions)
        assert sorted(updated.values()) == [
            (DetectorPriorityLevel.OK, 500.0),
            (DetectorPriorityLevel.HIGH, 800.0),
        ]
        action_request.refresh_from_db()
        assert action_request.state == InvestigationActionRequestState.APPLIED
        assert action_request.applied_by_id == self.user.id
        assert action_request.date_applied is not None
        assert self.snuba_query().time_window == 300

    def test_applies_a_time_window_change_to_an_errors_detector(self) -> None:
        action_request = self.suggest()
        conditions = self.conditions()

        response = self.apply(action_request)

        assert response.status_code == 200, response.data
        snuba_query = self.snuba_query()
        assert snuba_query.time_window == 900
        assert snuba_query.query == "level:error"
        assert snuba_query.environment == self.environment
        assert self.conditions() == conditions

    def test_applies_a_time_window_change_to_an_eap_detector(self) -> None:
        self.detector = self.create_metric_detector(dataset=Dataset.EventsAnalyticsPlatform)
        self.orchestration_run.update(
            source={"type": "breached_metric", "detectorId": str(self.detector.id)}
        )
        action_request = self.suggest()

        response = self.apply(action_request)

        assert response.status_code == 200, response.data
        snuba_query = self.snuba_query()
        assert snuba_query.time_window == 900
        assert snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
        assert snuba_query.event_types == [SnubaQueryEventType.EventType.TRACE_ITEM_SPAN]
        assert snuba_query.extrapolation_mode == ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED.value

    def test_applies_query_and_environment_changes(self) -> None:
        staging = self.create_environment(project=self.project, name="staging")
        action_request = self.suggest(
            before={"query": "level:error", "environment": "production"},
            changes={"query": "level:error !transaction:/health", "environment": "staging"},
        )
        conditions = self.conditions()

        response = self.apply(action_request)

        assert response.status_code == 200, response.data
        snuba_query = self.snuba_query()
        assert snuba_query.query == "level:error !transaction:/health"
        assert snuba_query.environment == staging
        assert snuba_query.time_window == 300
        assert self.conditions() == conditions

    def test_a_changed_query_is_stale(self) -> None:
        action_request = self.suggest(
            before={"query": "level:warning"}, changes={"query": "level:warning !logger:health"}
        )

        response = self.apply(action_request)

        assert response.status_code == 409
        assert response.data["code"] == "stale"
        assert response.data["current"] == {"query": "level:error"}
        assert self.snuba_query().query == "level:error"

    def details_request(self) -> dict[str, Any]:
        response = self.client.get(
            reverse(
                "sentry-api-0-organization-investigation-details",
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "investigation_id": self.investigation.id,
                },
            )
        )
        assert response.status_code == 200
        [action_request] = response.data["actionRequests"]
        return action_request

    def test_details_say_the_viewer_can_apply_a_change_to_the_monitor(self) -> None:
        self.suggest(
            before={"query": "level:error"}, changes={"query": "level:error !logger:health"}
        )

        serialized = self.details_request()

        assert (serialized["canApply"], serialized["cannotApplyReason"]) == (True, None)

    def test_a_dataset_the_plan_no_longer_allows_cannot_apply(self) -> None:
        self.detector = self.create_metric_detector(dataset=Dataset.EventsAnalyticsPlatform)
        self.orchestration_run.update(
            source={"type": "breached_metric", "detectorId": str(self.detector.id)}
        )
        self.suggest()

        with self.feature({"organizations:visibility-explore-view": False}):
            serialized = self.details_request()

        assert (serialized["canApply"], serialized["cannotApplyReason"]) == (
            False,
            "detector_not_found",
        )

    def test_requests_that_are_no_longer_suggested_conflict(self) -> None:
        action_request = self.suggest(state=InvestigationActionRequestState.SUPERSEDED)

        response = self.apply(action_request)

        assert response.status_code == 409
        assert response.data["code"] == "not_suggested"

    def test_a_second_apply_conflicts(self) -> None:
        action_request = self.suggest()
        assert self.apply(action_request).status_code == 200

        response = self.apply(action_request)

        assert response.status_code == 409
        assert response.data == {
            "detail": "This action was already applied.",
            "code": "already_applied",
        }

    def test_a_dry_run_runs_the_same_checks(self) -> None:
        action_request = self.suggest(state=InvestigationActionRequestState.SUPERSEDED)

        response = self.apply(action_request, dryRun=True)

        assert response.status_code == 409
        assert response.data["code"] == "not_suggested"

    def test_applies_the_action_the_user_saw(self) -> None:
        action_request = self.suggest()
        assert action_request.action_payload is not None

        response = self.apply(action_request, action=action_request.action_payload)

        assert response.status_code == 200, response.data
        assert self.snuba_query().time_window == 900

    def test_an_action_seer_changed_since_the_user_saw_it_conflicts(self) -> None:
        action_request = self.suggest()
        assert action_request.action_payload is not None
        seen = {**action_request.action_payload, "changes": {"timeWindowSeconds": 600}}

        for data in ({"action": seen}, {"action": seen, "dryRun": True}):
            response = self.apply(action_request, **data)

            assert response.status_code == 409
            assert response.data == {
                "detail": "Seer changed this suggestion. Check the new one.",
                "code": "action_changed",
            }
        action_request.refresh_from_db()
        assert action_request.state == InvestigationActionRequestState.SUGGESTED
        assert self.snuba_query().time_window == 300

    def test_rejects_an_unknown_field(self) -> None:
        response = self.apply(self.suggest(), dryRn=True)

        assert response.status_code == 400
        assert response.data == {"dryRn": "Unknown field."}

    def test_a_setting_seer_relied_on_but_did_not_change_counts_as_stale(self) -> None:
        action_request = self.suggest(
            before={"timeWindowSeconds": 300, "aggregate": "p95(transaction.duration)"},
            changes={"timeWindowSeconds": 900},
        )

        response = self.apply(action_request)

        assert response.status_code == 409
        assert response.data["current"] == {"aggregate": "count()"}
        assert self.snuba_query().time_window == 300

    def test_a_stale_monitor_conflicts_and_supersedes_the_suggestion(self) -> None:
        action_request = self.suggest(before={"timeWindowSeconds": 600})

        response = self.apply(action_request)

        assert response.status_code == 409
        assert response.data == {
            "detail": "This changed since Seer suggested it.",
            "code": "stale",
            "current": {"timeWindowSeconds": 300},
        }
        action_request.refresh_from_db()
        assert action_request.state == InvestigationActionRequestState.SUPERSEDED
        assert action_request.error == {"code": "stale", "current": {"timeWindowSeconds": 300}}
        assert self.snuba_query().time_window == 300
        assert self.apply(action_request).data["code"] == "not_suggested"

    def test_a_missing_threshold_is_stale(self) -> None:
        action_request = self.suggest(
            before={"mediumThreshold": 400}, changes={"mediumThreshold": 450}
        )

        response = self.apply(action_request)

        assert response.status_code == 409
        assert response.data["code"] == "stale"
        assert response.data["current"] == {"mediumThreshold": None}

    def test_only_the_source_monitor_can_change(self) -> None:
        other = self.create_metric_detector()
        action_request = self.suggest(detector_id=other.id)

        response = self.apply(action_request)

        assert response.status_code == 409
        assert response.data == {
            "detail": "This action can't be applied.",
            "code": "not_target_detector",
        }
        assert self.snuba_query(other).time_window == 300

    def test_a_deleted_monitor_is_not_found(self) -> None:
        action_request = self.suggest()
        self.detector.update(status=ObjectStatus.PENDING_DELETION)

        response = self.apply(action_request)

        assert response.status_code == 409
        assert response.data["code"] == "detector_not_found"

    def test_a_monitor_without_a_query_is_not_found(self) -> None:
        action_request = self.suggest()
        self.detector.data_sources.get().delete()

        response = self.apply(action_request)

        assert response.status_code == 409
        assert response.data == {
            "detail": "This monitor wasn't found.",
            "code": "detector_not_found",
        }
        action_request.refresh_from_db()
        assert action_request.state == InvestigationActionRequestState.SUGGESTED

    def test_another_organizations_monitor_is_not_found(self) -> None:
        foreign = self.create_detector(
            project=self.create_project(organization=self.create_organization()),
            type=MetricIssue.slug,
        )
        self.orchestration_run.update(
            source={"type": "breached_metric", "detectorId": str(foreign.id)}
        )
        action_request = self.suggest(detector_id=foreign.id)

        response = self.apply(action_request)

        assert response.status_code == 409
        assert response.data["code"] == "detector_not_found"

    def test_members_without_alerts_write_cannot_apply(self) -> None:
        self.organization.update_option("sentry:alerts_member_write", False)
        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member")
        self.login_as(member)
        action_request = self.suggest()

        response = self.apply(action_request)

        assert response.status_code == 403
        action_request.refresh_from_db()
        assert action_request.state == InvestigationActionRequestState.SUGGESTED
        assert self.snuba_query().time_window == 300

    def test_an_invalid_change_is_rejected_and_can_be_tried_again(self) -> None:
        self.detector = self.create_metric_detector(dataset=Dataset.EventsAnalyticsPlatform)
        self.orchestration_run.update(
            source={"type": "breached_metric", "detectorId": str(self.detector.id)}
        )
        action_request = self.suggest(changes={"timeWindowSeconds": 450})
        version = self.investigation.version

        response = self.apply(action_request)

        assert response.status_code == 400
        assert response.data["detail"] == "The change wasn't valid."
        assert response.data["code"] == "validation_failed"
        assert any("Invalid Time Window" in message for message in response.data["messages"])
        action_request.refresh_from_db()
        assert action_request.state == InvestigationActionRequestState.SUGGESTED
        assert action_request.error is None
        assert self.snuba_query().time_window == 300
        self.investigation.refresh_from_db()
        assert self.investigation.version == version

    def test_a_dry_run_of_a_valid_change_leaves_the_monitor_alone(self) -> None:
        action_request = self.suggest()

        response = self.apply(action_request, dryRun=True)

        assert response.status_code == 200, response.data
        assert response.data["actionRequest"]["state"] == "suggested"
        assert self.snuba_query().time_window == 300

    def test_a_dry_run_reports_an_invalid_change_without_failing_it(self) -> None:
        self.detector = self.create_metric_detector(dataset=Dataset.EventsAnalyticsPlatform)
        self.orchestration_run.update(
            source={"type": "breached_metric", "detectorId": str(self.detector.id)}
        )
        action_request = self.suggest(changes={"timeWindowSeconds": 450})

        response = self.apply(action_request, dryRun=True)

        assert response.status_code == 400
        assert response.data["code"] == "validation_failed"
        assert any("Invalid Time Window" in message for message in response.data["messages"])
        action_request.refresh_from_db()
        assert action_request.state == InvestigationActionRequestState.SUGGESTED
        assert action_request.error is None

    def test_a_dry_run_reports_a_stale_monitor_without_superseding_it(self) -> None:
        action_request = self.suggest(before={"timeWindowSeconds": 600})

        response = self.apply(action_request, dryRun=True)

        assert response.status_code == 409
        assert response.data["code"] == "stale"
        action_request.refresh_from_db()
        assert action_request.state == InvestigationActionRequestState.SUGGESTED

    def test_archived_investigations_are_read_only(self) -> None:
        action_request = self.suggest()
        self.investigation.update(status=InvestigationStatus.ARCHIVED)

        response = self.apply(action_request)

        assert response.status_code == 400
        assert response.data == {
            "detail": "Archived investigations are read-only.",
            "code": "investigation_archived",
        }

    def test_the_kind_check_that_hides_the_button_also_guards_apply(self) -> None:
        self.organization.update_option("sentry:alerts_member_write", False)
        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member")
        self.login_as(member)
        action_request = self.suggest()

        response = self.apply(action_request)

        assert response.status_code == 403
        assert response.data["code"] == "permission_denied"
        action_request.refresh_from_db()
        assert action_request.state == InvestigationActionRequestState.SUGGESTED

    def test_requests_without_a_supported_action_cannot_apply(self) -> None:
        for key, action in [("no-action", None), ("task", {"kind": "seer_task", "prompt": "Go"})]:
            action_request = self.create_investigation_action_request(
                investigation=self.investigation,
                key=key,
                action_kind=action["kind"] if action else None,
                action_payload=action,
            )

            response = self.apply(action_request)

            assert response.status_code == 400
            assert response.data == {
                "detail": "This request has no action to apply.",
                "code": "unsupported_action",
            }

    def test_a_withdrawn_request_is_no_longer_suggested(self) -> None:
        action_request = self.suggest(
            state=InvestigationActionRequestState.WITHDRAWN, reason="The spikes are real."
        )

        response = self.apply(action_request)

        assert response.status_code == 409
        assert response.data == {
            "detail": "Seer no longer suggests this.",
            "code": "withdrawn",
            "reason": "The spikes are real.",
        }
        assert self.snuba_query().time_window == 300

    def test_requests_from_other_investigations_are_not_found(self) -> None:
        other = self.create_investigation(organization=self.organization, created_by=self.user)
        self.create_investigation_orchestration_run(investigation=other)
        action_request = self.suggest()

        response = self.client.post(
            self.apply_url(action_request.id, investigation_id=other.id), data={}, format="json"
        )
        assert response.status_code == 404
        assert self.client.post(self.apply_url("abc"), data={}, format="json").status_code == 404

    def test_requires_the_feature(self) -> None:
        action_request = self.suggest()

        with self.feature({FEATURE: False}):
            response = self.client.post(self.apply_url(action_request.id), data={}, format="json")

        assert response.status_code == 404

    def set_detector(self, **kwargs: Any) -> None:
        self.detector = self.create_metric_detector(**kwargs)
        self.orchestration_run.update(
            source={"type": "breached_metric", "detectorId": str(self.detector.id)}
        )

    def test_applies_a_high_and_resolution_change_together(self) -> None:
        action_request = self.suggest(
            before={"highThreshold": 500, "resolutionThreshold": 500},
            changes={"highThreshold": 400, "resolutionThreshold": 400},
        )

        response = self.apply(action_request)

        assert response.status_code == 200, response.data
        assert sorted(self.conditions().values()) == [
            (DetectorPriorityLevel.OK, 400.0),
            (DetectorPriorityLevel.HIGH, 400.0),
        ]

    def test_applies_a_medium_threshold_change_and_keeps_every_condition(self) -> None:
        self.set_detector(
            conditions=[
                (Condition.GREATER, 800.0, DetectorPriorityLevel.HIGH),
                (Condition.GREATER, 500.0, DetectorPriorityLevel.MEDIUM),
                (Condition.LESS_OR_EQUAL, 500.0, DetectorPriorityLevel.OK),
            ]
        )
        conditions = self.conditions()
        action_request = self.suggest(
            before={"mediumThreshold": 500, "resolutionThreshold": 500},
            changes={"mediumThreshold": 600, "resolutionThreshold": 600},
        )

        response = self.apply(action_request)

        assert response.status_code == 200, response.data
        updated = self.conditions()
        assert set(updated) == set(conditions)
        assert sorted(updated.values()) == [
            (DetectorPriorityLevel.OK, 600.0),
            (DetectorPriorityLevel.MEDIUM, 600.0),
            (DetectorPriorityLevel.HIGH, 800.0),
        ]

    def test_applies_a_raw_threshold_to_a_percent_monitor(self) -> None:
        self.set_detector(high=110.0, config={"detection_type": "static", "comparison_delta": 3600})
        action_request = self.suggest(
            before={"highThreshold": 110, "resolutionThreshold": 110},
            changes={"highThreshold": 130, "resolutionThreshold": 130},
        )

        response = self.apply(action_request)

        assert response.status_code == 200, response.data
        assert sorted(self.conditions().values()) == [
            (DetectorPriorityLevel.OK, 130.0),
            (DetectorPriorityLevel.HIGH, 130.0),
        ]
        self.detector.refresh_from_db()
        assert self.detector.config["comparison_delta"] == 3600

    def test_two_conditions_for_one_level_are_stale(self) -> None:
        self.set_detector(
            conditions=[
                (Condition.GREATER, 500.0, DetectorPriorityLevel.HIGH),
                (Condition.LESS, 10.0, DetectorPriorityLevel.HIGH),
                (Condition.LESS_OR_EQUAL, 500.0, DetectorPriorityLevel.OK),
            ]
        )
        conditions = self.conditions()
        action_request = self.suggest(before={"highThreshold": 500}, changes={"highThreshold": 800})

        response = self.apply(action_request)

        assert response.status_code == 409
        assert response.data["code"] == "stale"
        assert response.data["current"] == {"highThreshold": None}
        assert self.conditions() == conditions

    def test_dynamic_monitors_are_not_changed(self) -> None:
        self.set_detector(config={"detection_type": "dynamic"})
        action_request = self.suggest()

        response = self.apply(action_request)

        assert response.status_code == 409
        assert response.data == {
            "detail": "This action can't be applied.",
            "code": "dynamic_detector",
        }
        action_request.refresh_from_db()
        assert action_request.state == InvestigationActionRequestState.SUGGESTED
        assert self.snuba_query().time_window == 300

    def test_a_dataset_the_plan_no_longer_allows_is_not_found(self) -> None:
        self.set_detector(dataset=Dataset.EventsAnalyticsPlatform)
        action_request = self.suggest()

        with self.feature({"organizations:visibility-explore-view": False}):
            response = self.apply(action_request)

        assert response.status_code == 409
        assert response.data["code"] == "detector_not_found"
        assert self.snuba_query().time_window == 300

    def test_an_unknown_environment_is_invalid_and_not_created(self) -> None:
        action_request = self.suggest(
            before={"environment": "production"}, changes={"environment": "made-up"}
        )

        dry_run = self.apply(action_request, dryRun=True)

        assert dry_run.status_code == 400
        assert dry_run.data["messages"] == ["The project has no made-up environment."]
        assert not Environment.objects.filter(name="made-up").exists()

    def test_a_transaction_monitor_change_fails_before_saving(self) -> None:
        snuba_query = self.snuba_query()
        snuba_query.update(
            type=SnubaQuery.Type.PERFORMANCE.value, dataset=Dataset.Transactions.value, query=""
        )
        snuba_query.snubaqueryeventtype_set.update(
            type=SnubaQueryEventType.EventType.TRANSACTION.value
        )
        action_request = self.suggest(
            before={"timeWindowSeconds": 300, "highThreshold": 500},
            changes={"timeWindowSeconds": 900, "highThreshold": 800},
        )
        conditions = self.conditions()

        with self.feature("organizations:discover-saved-queries-deprecation"):
            dry_run = self.apply(action_request, dryRun=True)
            response = self.apply(action_request)

        assert dry_run.status_code == 400
        assert dry_run.data["code"] == "validation_failed"

        assert response.status_code == 400
        assert response.data["code"] == "validation_failed"
        assert response.data["messages"] == [TRANSACTION_UPDATES_DISABLED]
        assert self.conditions() == conditions
        assert self.snuba_query().time_window == 300
        action_request.refresh_from_db()
        assert action_request.state == InvestigationActionRequestState.SUGGESTED

    @override_settings(SEER_API_SHARED_SECRET="test-seer-api-shared-secret-thirty-two-bytes!")
    def test_an_agent_token_without_alerts_write_cannot_apply(self) -> None:
        action_request = self.suggest()
        token, _ = agent_token.encode_agent_token(
            user_id=self.user.id,
            organization_id=self.organization.id,
            scopes=["org:read"],
            session_id="investigation-apply",
        )
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        with self.feature(agent_token.FEATURE_FLAG):
            response = client.post(self.apply_url(action_request.id), data={}, format="json")

        assert response.status_code == 403, response.content
        assert response.data["code"] == "permission_denied"
        action_request.refresh_from_db()
        assert action_request.state == InvestigationActionRequestState.SUGGESTED

    def test_applying_records_activity_and_an_audit_entry(self) -> None:
        self.detector.update(name="Checkout [p95]")
        action_request = self.suggest(
            title="Widen the window",
            before={"timeWindowSeconds": 300, "highThreshold": 500},
            changes={"timeWindowSeconds": 3600, "highThreshold": 800.5},
            report_revision=2,
        )
        blocks = InvestigationBlock.objects.filter(investigation=self.investigation).count()
        version = self.investigation.version

        with outbox_runner():
            response = self.apply(action_request)

        assert response.status_code == 200, response.data
        assert "blockId" not in response.data
        serialized = response.data["actionRequest"]
        assert serialized["appliedBy"]["id"] == str(self.user.id)
        # Reads look up the applier, so renaming them afterwards shows the new name.
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user.update(name="Renamed after the apply")
        details = self.client.get(
            reverse(
                "sentry-api-0-organization-investigation-details",
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "investigation_id": self.investigation.id,
                },
            )
        )
        [read] = details.data["actionRequests"]
        assert read["appliedBy"]["id"] == str(self.user.id)
        assert read["appliedBy"]["name"] == "Renamed after the apply"
        assert serialized["appliedDetails"] == {
            "detectorId": str(self.detector.id),
            "detectorName": "Checkout [p95]",
            "fields": ["timeWindowSeconds", "highThreshold"],
        }
        assert InvestigationBlock.objects.filter(investigation=self.investigation).count() == blocks
        self.investigation.refresh_from_db()
        assert self.investigation.version == version

        with assume_test_silo_mode(SiloMode.CONTROL):
            entry = AuditLogEntry.objects.get(event=audit_log.get_event_id("DETECTOR_EDIT"))
        assert entry.actor_id == self.user.id
        assert entry.data["name"] == "Checkout [p95]"

    def test_activity_shows_query_and_environment_changes(self) -> None:
        self.create_environment(project=self.project, name="staging")
        action_request = self.suggest(
            before={"query": "level:error", "environment": "production"},
            changes={"query": "", "environment": "staging"},
        )

        with outbox_runner():
            response = self.apply(action_request)

        assert response.status_code == 200, response.data
        details = response.data["actionRequest"]["appliedDetails"]
        assert details["fields"] == ["query", "environment"]


@with_feature(FEATURE)
class SharedApplyPathTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        kind = fake_action_kind()
        kind.start()
        self.addCleanup(kind.stop)
        recording = ACTION_KINDS["test_kind"]
        assert isinstance(recording, RecordingKind)
        self.kind = recording
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user
        )
        self.orchestration_run = self.create_investigation_orchestration_run(
            investigation=self.investigation,
            workflow_version=4,
            phase=InvestigationOrchestrationPhase.COMPLETED,
            projection={"workflowVersion": 4, "report": {"revision": 2, "status": "completed"}},
        )
        self.action_request = self.create_investigation_action_request(
            investigation=self.investigation,
            key="widen-time-window",
            report_revision=2,
            action_kind="test_kind",
            action_payload=fake_action(),
        )

    def post(self, **data: Any) -> Any:
        url = reverse(
            "sentry-api-0-organization-investigation-action-request-apply",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
                "action_request_id": self.action_request.id,
            },
        )
        return self.client.post(url, data=data, format="json")

    def recheck(self, **data: Any) -> Any:
        url = reverse(
            "sentry-api-0-organization-investigation-action-request-recheck",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
                "action_request_id": self.action_request.id,
            },
        )
        return self.client.post(url, data=data, format="json")

    def commands(self) -> list[InvestigationOrchestrationCommand]:
        return list(
            InvestigationOrchestrationCommand.objects.filter(
                orchestration_run=self.orchestration_run
            )
        )

    def test_a_recheck_of_a_stale_request_supersedes_it_and_asks_seer(self) -> None:
        self.kind.raises = ActionStale({"window": 600})

        response = self.recheck()

        assert response.status_code == 200, response.data
        assert self.kind.calls == ["check"]
        [command] = self.commands()
        assert command.type == "recheck_action_requests"
        assert (command.expected_workflow_version, command.resulting_workflow_version) == (4, 5)
        read = response.data["actionRequest"]
        assert read["state"] == "superseded"
        assert read["error"] == {"code": "stale", "current": {"window": 600}}
        assert read["followUp"] == {
            "status": "accepted",
            "reason": None,
            "rerun": None,
            "retryable": False,
        }
        self.action_request.refresh_from_db()
        assert self.action_request.followup_request_id == command.request_id

    def test_a_recheck_with_nothing_moved_is_not_stale(self) -> None:
        response = self.recheck()

        assert response.status_code == 409
        assert response.data == {
            "detail": "Nothing changed since Seer suggested this.",
            "code": "not_stale",
        }
        assert self.kind.calls == ["check"]
        assert self.commands() == []
        self.action_request.refresh_from_db()
        assert self.action_request.state == InvestigationActionRequestState.SUGGESTED

    def test_a_recheck_of_an_invalid_change_is_the_same_error_as_apply(self) -> None:
        self.kind.raises = ActionInvalid(["Pick a supported window."])

        response = self.recheck()

        assert response.status_code == 400
        assert response.data == {
            "detail": "The change wasn't valid.",
            "code": "validation_failed",
            "messages": ["Pick a supported window."],
        }
        assert self.commands() == []

    def test_a_recheck_keeps_nothing_a_check_writes(self) -> None:
        title = self.action_request.title
        self.kind.check_title = "Changed by the check"

        assert self.recheck().data["code"] == "not_stale"

        self.action_request.refresh_from_db()
        assert self.action_request.title == title

    def test_a_queued_recheck_is_not_sent_again(self) -> None:
        self.kind.raises = ActionStale({"window": 600})
        assert self.recheck().status_code == 200

        response = self.recheck()

        assert response.status_code == 409
        assert response.data["code"] == "not_suggested"
        assert len(self.commands()) == 1

    def test_a_recheck_seer_never_got_goes_out_again_as_the_same_command(self) -> None:
        self.kind.raises = ActionStale({"window": 600})
        assert self.recheck().status_code == 200
        [failed] = self.commands()
        failed.update(
            status=InvestigationOrchestrationCommandStatus.FAILED,
            error={"code": "seer_command_dispatch_failed", "retryable": True},
        )
        self.kind.calls.clear()

        response = self.recheck()

        assert response.status_code == 200, response.data
        assert self.kind.calls == []
        [command] = self.commands()
        assert command.request_id == failed.request_id
        assert command.status == InvestigationOrchestrationCommandStatus.ACCEPTED
        assert command.expected_workflow_version == 4
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.workflow_version == 5
        read = response.data["actionRequest"]
        assert read["error"] == {"code": "stale", "current": {"window": 600}}
        assert read["followUp"] == {
            "status": "accepted",
            "reason": None,
            "rerun": None,
            "retryable": False,
        }

    def test_a_recheck_behind_an_undelivered_command_waits_for_it(self) -> None:
        self.kind.raises = ActionStale({"window": 600})
        assert self.recheck().status_code == 200
        [failed] = self.commands()
        failed.update(
            status=InvestigationOrchestrationCommandStatus.FAILED,
            error={"code": "earlier_command_failed"},
        )

        response = self.recheck()

        assert response.status_code == 409
        assert response.data["code"] == "not_retryable"
        assert self.commands() == [failed]

    def test_a_recheck_seer_turned_down_goes_out_as_a_new_command(self) -> None:
        self.kind.raises = ActionStale({"window": 600})
        assert self.recheck().status_code == 200
        [failed] = self.commands()
        failed.update(
            status=InvestigationOrchestrationCommandStatus.FAILED,
            error={
                "code": "seer_command_dispatch_failed",
                "reason": "workflow_version_conflict",
                "retryable": False,
            },
        )
        # The conflict reconcile moves Sentry back to Seer's version.
        self.orchestration_run.update(workflow_version=4)
        self.kind.calls.clear()

        response = self.recheck()

        assert response.status_code == 200, response.data
        assert self.kind.calls == []
        [command] = [command for command in self.commands() if command.id != failed.id]
        assert command.type == "recheck_action_requests"
        assert command.request_id != failed.request_id
        assert command.expected_workflow_version == 4
        read = response.data["actionRequest"]
        assert read["error"] == {"code": "stale", "current": {"window": 600}}
        assert read["followUp"] == {
            "status": "accepted",
            "reason": None,
            "rerun": None,
            "retryable": False,
        }

    def test_a_recheck_of_an_action_seer_changed_since_the_user_saw_it_conflicts(self) -> None:
        self.kind.raises = ActionStale({"window": 600})
        assert self.action_request.action_payload is not None
        seen = {**self.action_request.action_payload, "seen": "an older suggestion"}

        response = self.recheck(action=seen)

        assert response.status_code == 409
        assert response.data == {
            "detail": "Seer changed this suggestion. Check the new one.",
            "code": "action_changed",
        }
        assert self.kind.calls == []
        assert self.commands() == []
        assert self.recheck(action=self.action_request.action_payload).status_code == 200

    def test_a_recheck_goes_through_the_apply_guard(self) -> None:
        self.action_request.update(state=InvestigationActionRequestState.APPLIED)

        response = self.recheck()

        assert response.status_code == 409
        assert response.data["code"] == "already_applied"
        assert self.kind.calls == []

    def test_a_dry_run_only_checks(self) -> None:
        response = self.post(dryRun=True)

        assert response.status_code == 200, response.data
        assert self.kind.calls == ["check_remote", "check"]
        self.action_request.refresh_from_db()
        assert self.action_request.state == InvestigationActionRequestState.SUGGESTED

    def test_a_dry_run_keeps_nothing_a_check_writes(self) -> None:
        title = self.action_request.title
        self.kind.check_title = "Changed by the check"

        response = self.post(dryRun=True)

        assert response.status_code == 200, response.data
        self.action_request.refresh_from_db()
        assert self.action_request.title == title

    def test_applying_records_what_the_kind_returns(self) -> None:
        response = self.post()

        assert response.status_code == 200, response.data
        assert self.kind.calls == ["check_remote", "apply"]
        self.action_request.refresh_from_db()
        assert self.action_request.state == InvestigationActionRequestState.APPLIED
        assert self.action_request.applied_by_id == self.user.id
        assert self.action_request.applied_details == {"target": "a"}

    def test_applying_tells_seer_the_outcome(self) -> None:
        response = self.post()

        assert response.status_code == 200, response.data
        [command] = self.commands()
        assert {"type": command.type, **command.payload} == {
            **fixture("command_record_action_outcome"),
            "action": fake_action(),
            "appliedBy": self.user.id,
        }
        assert command.actor_id == self.user.id
        assert (command.expected_workflow_version, command.resulting_workflow_version) == (4, 4)
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.workflow_version == 4

    def test_the_outcome_goes_to_seer_as_the_user_who_applied_it(self) -> None:
        applier = self.create_user()
        self.create_member(user=applier, organization=self.organization, role="owner")
        self.login_as(applier)

        assert self.post().status_code == 200

        [command] = self.commands()
        assert command.actor_id == applier.id
        assert command.payload["appliedBy"] == applier.id

    def test_only_a_successful_apply_tells_seer(self) -> None:
        assert self.post(dryRun=True).status_code == 200
        self.kind.raises = ActionInvalid(["Pick a supported window."])
        assert self.post().status_code == 400
        self.kind.raises = ActionStale({"window": 600})
        assert self.post().status_code == 409

        assert [command.type for command in self.commands()] == ["recheck_action_requests"]

    def test_a_failed_remote_check_stops_before_the_kind_applies(self) -> None:
        self.kind.remote_raises = ActionInvalid(["Not connected."])

        response = self.post()

        assert response.status_code == 400
        assert response.data["messages"] == ["Not connected."]
        assert self.kind.calls == ["check_remote"]
        self.action_request.refresh_from_db()
        assert self.action_request.state == InvestigationActionRequestState.SUGGESTED

    def test_a_request_the_viewer_cannot_apply_skips_the_remote_check(self) -> None:
        self.kind.reason = CannotApplyReason.PERMISSION_DENIED

        response = self.post()

        assert response.status_code == 403
        assert response.data["code"] == "permission_denied"
        assert self.kind.calls == []

    def test_requests_that_are_not_suggested_skip_the_remote_check(self) -> None:
        self.action_request.update(state=InvestigationActionRequestState.APPLIED)

        assert self.post().data["code"] == "already_applied"
        assert self.kind.calls == []

    def test_a_stale_action_is_superseded_with_what_moved(self) -> None:
        self.kind.raises = ActionStale({"window": 600})

        response = self.post()

        assert response.status_code == 409
        assert response.data == {
            "detail": "This changed since Seer suggested it.",
            "code": "stale",
            "current": {"window": 600},
        }
        self.action_request.refresh_from_db()
        assert self.action_request.state == InvestigationActionRequestState.SUPERSEDED
        assert self.action_request.error == {"code": "stale", "current": {"window": 600}}

    def test_a_stale_action_asks_seer_to_check_again(self) -> None:
        self.kind.raises = ActionStale({"window": 600})

        assert self.post().status_code == 409

        [command] = self.commands()
        assert command.type == "recheck_action_requests"
        assert {"type": command.type, **command.payload}.keys() == fixture(
            "command_recheck_action_requests"
        ).keys()
        assert command.payload["reportRevision"] == 2
        assert command.actor_id == self.user.id
        assert (command.expected_workflow_version, command.resulting_workflow_version) == (4, 5)
        self.action_request.refresh_from_db()
        assert self.action_request.followup_request_id == command.request_id
        details = self.client.get(
            reverse(
                "sentry-api-0-organization-investigation-details",
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "investigation_id": self.investigation.id,
                },
            )
        )
        [read] = details.data["actionRequests"]
        assert read["followUp"] == {
            "status": "accepted",
            "reason": None,
            "rerun": None,
            "retryable": False,
        }

    def test_a_stale_action_seer_cant_recheck_stops_being_listed(self) -> None:
        for phase, report in (
            (InvestigationOrchestrationPhase.INVESTIGATING, {"revision": 2, "status": "completed"}),
            (InvestigationOrchestrationPhase.COMPLETED, {"revision": 3, "status": "completed"}),
            (InvestigationOrchestrationPhase.METADATA, {"revision": 2, "status": "composing"}),
        ):
            self.orchestration_run.update(phase=phase, projection={"report": report})
            self.action_request.update(state=InvestigationActionRequestState.SUGGESTED, error=None)
            self.kind.raises = ActionStale({"window": 600})

            assert self.post().status_code == 409

            assert self.commands() == []
            self.action_request.refresh_from_db()
            assert self.action_request.state == InvestigationActionRequestState.SUPERSEDED
            assert self.action_request.error == {"code": "stale", "current": {"window": 600}}
            assert self.action_request.followup_request_id is None
            details = self.client.get(
                reverse(
                    "sentry-api-0-organization-investigation-details",
                    kwargs={
                        "organization_id_or_slug": self.organization.slug,
                        "investigation_id": self.investigation.id,
                    },
                )
            )
            assert details.data["actionRequests"] == []

    def test_a_stale_dry_run_changes_nothing(self) -> None:
        self.kind.raises = ActionStale({"window": 600})

        response = self.post(dryRun=True)

        assert response.status_code == 409
        self.action_request.refresh_from_db()
        assert self.action_request.state == InvestigationActionRequestState.SUGGESTED
        assert self.action_request.error is None
        assert self.action_request.followup_request_id is None
        assert self.commands() == []

    def test_an_invalid_action_stays_suggested(self) -> None:
        self.kind.raises = ActionInvalid(["Pick a supported window."])

        response = self.post()

        assert response.status_code == 400
        assert response.data == {
            "detail": "The change wasn't valid.",
            "code": "validation_failed",
            "messages": ["Pick a supported window."],
        }
        self.action_request.refresh_from_db()
        assert self.action_request.state == InvestigationActionRequestState.SUGGESTED


@with_feature(FEATURE)
class BreachedMetricRecheckTest(BreachedMetricInvestigationTestCase):
    def test_the_recheck_sends_the_source_the_run_started_with(self) -> None:
        self.login_as(self.user)
        kind = fake_action_kind()
        kind.start()
        self.addCleanup(kind.stop)
        recording = ACTION_KINDS["test_kind"]
        assert isinstance(recording, RecordingKind)
        recording.raises = ActionStale({"window": 600})
        InvestigationOrchestrationRun.objects.filter(investigation=self.investigation).update(
            phase=InvestigationOrchestrationPhase.COMPLETED,
            projection={"report": {"revision": 1, "status": "completed"}},
        )
        action_request = self.create_investigation_action_request(
            investigation=self.investigation,
            report_revision=1,
            key="widen-time-window",
            action_kind="test_kind",
            action_payload=fake_action(),
        )

        response = self.client.post(
            reverse(
                "sentry-api-0-organization-investigation-action-request-apply",
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "investigation_id": self.investigation.id,
                    "action_request_id": action_request.id,
                },
            ),
            format="json",
        )

        assert response.status_code == 409
        command = InvestigationOrchestrationCommand.objects.get(type="recheck_action_requests")
        assert command.payload["source"] == self.started_source(self.investigation)

    def test_a_stale_request_seer_cannot_be_asked_about_is_not_listed(self) -> None:
        self.login_as(self.user)
        kind = fake_action_kind()
        kind.start()
        self.addCleanup(kind.stop)
        recording = ACTION_KINDS["test_kind"]
        assert isinstance(recording, RecordingKind)
        recording.raises = ActionStale({"window": 600})
        action_request = self.create_investigation_action_request(
            investigation=self.investigation,
            key="widen-time-window",
            action_kind="test_kind",
            action_payload=fake_action(),
        )
        GroupOpenPeriod.objects.filter(id=self.investigation.source_ref["openPeriodId"]).delete()

        response = self.client.post(
            reverse(
                "sentry-api-0-organization-investigation-action-request-recheck",
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "investigation_id": self.investigation.id,
                    "action_request_id": action_request.id,
                },
            ),
            format="json",
        )

        assert response.status_code == 200
        assert not InvestigationOrchestrationCommand.objects.filter(
            type="recheck_action_requests"
        ).exists()
        details = self.client.get(
            reverse(
                "sentry-api-0-organization-investigation-details",
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "investigation_id": self.investigation.id,
                },
            )
        )
        assert details.json()["actionRequests"] == []
