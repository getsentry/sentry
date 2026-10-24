from __future__ import annotations

from collections.abc import Sequence
from datetime import timedelta
from typing import Any

from django.urls import reverse

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.subscription_limits import METRIC_SUBSCRIPTION_FEATURE_FLAGS
from sentry.investigations.models import (
    InvestigationActionRequest,
    InvestigationActionRequestState,
    InvestigationStatus,
)
from sentry.investigations.services.action_kinds import ACTION_KINDS
from sentry.investigations.services.action_kinds.base import ActionInvalid, ActionStale
from sentry.seer.models.run import SeerRunMirrorStatus, SeerRunType
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import ExtrapolationMode, SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_kafka, requires_snuba
from sentry.workflow_engine.models import DataConditionGroup, Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.investigations.test_contracts import RecordingKind, fake_action, fake_action_kind

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

    def test_a_dry_run_runs_the_same_checks(self) -> None:
        action_request = self.suggest(state=InvestigationActionRequestState.SUPERSEDED)

        response = self.apply(action_request, dryRun=True)

        assert response.status_code == 409
        assert response.data["code"] == "not_suggested"

    def test_a_dry_run_changes_nothing(self) -> None:
        action_request = self.create_investigation_action_request(
            investigation=self.investigation,
            key="task",
            action_kind="seer_task",
            action_payload={"kind": "seer_task", "prompt": "Go"},
        )
        version = self.investigation.version

        response = self.apply(action_request, dryRun=True)

        assert response.status_code == 400
        assert response.data["code"] == "unsupported_action"
        action_request.refresh_from_db()
        self.investigation.refresh_from_db()
        assert action_request.state == InvestigationActionRequestState.SUGGESTED
        assert self.investigation.version == version

    def test_rejects_an_unknown_field(self) -> None:
        response = self.apply(self.suggest(), dryRn=True)

        assert response.status_code == 400
        assert response.data == {"dryRn": "Unknown field."}

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
        self.create_investigation_orchestration_run(investigation=self.investigation)
        self.action_request = self.create_investigation_action_request(
            investigation=self.investigation,
            key="test",
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

    def test_a_dry_run_only_checks(self) -> None:
        response = self.post(dryRun=True)

        assert response.status_code == 200, response.data
        assert self.kind.calls == ["check"]
        self.action_request.refresh_from_db()
        assert self.action_request.state == InvestigationActionRequestState.SUGGESTED

    def test_applying_records_what_the_kind_returns(self) -> None:
        response = self.post()

        assert response.status_code == 200, response.data
        assert self.kind.calls == ["apply"]
        self.action_request.refresh_from_db()
        assert self.action_request.state == InvestigationActionRequestState.APPLIED
        assert self.action_request.applied_by_id == self.user.id
        assert self.action_request.applied_details == {"target": "a"}

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

    def test_a_stale_dry_run_changes_nothing(self) -> None:
        self.kind.raises = ActionStale({"window": 600})

        response = self.post(dryRun=True)

        assert response.status_code == 409
        self.action_request.refresh_from_db()
        assert self.action_request.state == InvestigationActionRequestState.SUGGESTED
        assert self.action_request.error is None

    def test_an_invalid_action_stays_suggested(self) -> None:
        self.kind.raises = ActionInvalid({"window": ["Pick a supported window."]})

        response = self.post()

        assert response.status_code == 400
        assert response.data == {
            "detail": "The change wasn't valid.",
            "code": "validation_failed",
            "messages": ["Pick a supported window."],
        }
        self.action_request.refresh_from_db()
        assert self.action_request.state == InvestigationActionRequestState.SUGGESTED
