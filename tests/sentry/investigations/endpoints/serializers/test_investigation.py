from __future__ import annotations

from typing import Any
from uuid import uuid4

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.auth.access import from_user
from sentry.constants import ObjectStatus
from sentry.incidents.grouptype import MetricIssue
from sentry.investigations.endpoints.serializers import (
    InvestigationDetailsSerializer,
    InvestigationDetailsSerializerResponse,
    InvestigationSerializer,
)
from sentry.investigations.models import (
    Investigation,
    InvestigationActionRequest,
    InvestigationActionRequestState,
    InvestigationBlockExecutionStatus,
    InvestigationOrchestrationCommandStatus,
    InvestigationOrchestrationRerun,
    InvestigationStatus,
)
from sentry.investigations.services.action_kinds import ACTION_KINDS
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from tests.sentry.investigations.test_contracts import RecordingKind, fake_action, fake_action_kind


class InvestigationSerializerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Latency spike"
        )

    def test_serializes_the_list_representation(self) -> None:
        result = serialize(self.investigation, self.user, InvestigationSerializer())

        assert result == {
            "id": str(self.investigation.id),
            "title": "Latency spike",
            "summary": None,
            "summaryDescription": None,
            "status": self.investigation.status,
            "sourceType": "manual",
            "createdBy": str(self.user.id),
            "creator": {"type": "user", "id": str(self.user.id)},
            "dateCreated": self.investigation.date_added,
            "dateUpdated": self.investigation.date_updated,
            "version": 1,
            "blockCount": 0,
            "isFavorited": False,
            "titleGeneration": {"status": None},
            "orchestration": None,
        }

    def test_serializes_account_and_missing_creators(self) -> None:
        account = self.create_service_account(organization=self.organization, id=910001)
        self.investigation.update(created_by_id=None, created_by_service_account_id=account.id)

        result = serialize(self.investigation, self.user, InvestigationSerializer())

        assert result["createdBy"] is None
        assert result["creator"] == {"type": "service_account", "id": str(account.id)}

        self.investigation.update(created_by_service_account_id=None)
        assert (
            serialize(self.investigation, self.user, InvestigationSerializer())["creator"] is None
        )

    def test_serializes_compact_orchestration_state_without_a_mode(self) -> None:
        heartbeat = timezone.now()
        self.create_investigation_orchestration_run(
            investigation=self.investigation,
            phase="investigating",
            status="processing",
            notebook_revision=4,
            heartbeat_at=heartbeat,
        )

        result = serialize(self.investigation, self.user, InvestigationSerializer())

        assert "mode" not in result
        assert result["orchestration"] == {
            "phase": "investigating",
            "status": "processing",
            "heartbeatAt": heartbeat,
            "notebookRevision": 4,
        }

    def test_counts_only_active_blocks(self) -> None:
        self.create_investigation_block(investigation=self.investigation, position=0)
        deleted = self.create_investigation_block(investigation=self.investigation, position=1)
        deleted.update(deleted_at=self.investigation.date_added)

        result = serialize(self.investigation, self.user, InvestigationSerializer())

        assert result["blockCount"] == 1

    def test_reports_the_viewers_own_favorite(self) -> None:
        other_user = self.create_user()
        self.create_investigation_favorite(investigation=self.investigation, user=other_user)

        assert not serialize(self.investigation, self.user, InvestigationSerializer())[
            "isFavorited"
        ]
        assert serialize(self.investigation, other_user, InvestigationSerializer())["isFavorited"]

    def test_is_registered_for_bare_serialize_calls(self) -> None:
        assert serialize(self.investigation, self.user) == serialize(
            self.investigation, self.user, InvestigationSerializer()
        )

    def test_query_count_does_not_grow_with_the_number_of_investigations(self) -> None:
        for index in range(3):
            investigation = self.create_investigation(
                organization=self.organization, title=f"First {index}"
            )
            self.create_investigation_block(investigation=investigation, position=0)
            self.create_investigation_favorite(investigation=investigation, user=self.user)
            self.create_investigation_orchestration_run(investigation=investigation)

        first_batch = list(Investigation.objects.filter(organization=self.organization))
        serialize(
            first_batch,
            self.user,
            InvestigationSerializer(),
        )
        with CaptureQueriesContext(connection) as first_queries:
            serialize(
                first_batch,
                self.user,
                InvestigationSerializer(),
            )

        for index in range(3, 12):
            investigation = self.create_investigation(
                organization=self.organization, title=f"Second {index}"
            )
            self.create_investigation_block(investigation=investigation, position=0)
            self.create_investigation_favorite(investigation=investigation, user=self.user)
            self.create_investigation_orchestration_run(investigation=investigation)

        second_batch = list(Investigation.objects.filter(organization=self.organization))
        with CaptureQueriesContext(connection) as second_queries:
            results = serialize(
                second_batch,
                self.user,
                InvestigationSerializer(),
            )

        assert len(second_batch) > len(first_batch)
        assert len(second_queries.captured_queries) == len(first_queries.captured_queries)
        counts = sorted(result["blockCount"] for result in results)
        # Only the setUp investigation has no blocks; every created one has exactly one.
        assert counts == [0] + [1] * (len(second_batch) - 1)
        assert (
            sum(result["orchestration"] is not None for result in results) == len(second_batch) - 1
        )


class InvestigationDetailsSerializerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Investigation"
        )
        self.create_investigation_project(investigation=self.investigation, project=self.project)
        self.block = self.create_investigation_block(investigation=self.investigation, position=0)

    def serialize_detail(self) -> InvestigationDetailsSerializerResponse:
        return serialize(
            self.investigation,
            self.user,
            InvestigationDetailsSerializer(),
        )

    def test_extends_the_list_representation(self) -> None:
        listed = serialize(self.investigation, self.user, InvestigationSerializer())
        detail = self.serialize_detail()

        # cast to a plain dict: a TypedDict cannot be indexed by a variable key
        detail_items: dict[str, Any] = dict(detail)
        assert set(listed) < set(detail_items)
        for key, value in listed.items():
            assert detail_items[key] == value

    def test_serializes_nested_collections(self) -> None:
        self.investigation.update(
            summary="Errors crossed alert threshold",
            summary_description="Checkout failures increased.\nRoll back the latest release.",
        )
        detail = self.serialize_detail()

        assert detail["summary"] == "Errors crossed alert threshold"
        assert detail["summaryDescription"] == (
            "Checkout failures increased.\nRoll back the latest release."
        )
        assert detail["projectIds"] == [self.project.id]
        assert detail["parameters"] == []
        assert [block["id"] for block in detail["blocks"]] == [str(self.block.id)]

    def test_orders_blocks_by_position(self) -> None:
        second = self.create_investigation_block(investigation=self.investigation, position=1)
        third = self.create_investigation_block(investigation=self.investigation, position=2)

        detail = self.serialize_detail()

        assert [block["id"] for block in detail["blocks"]] == [
            str(self.block.id),
            str(second.id),
            str(third.id),
        ]

    def test_omits_soft_deleted_blocks(self) -> None:
        deleted = self.create_investigation_block(investigation=self.investigation, position=1)
        deleted.update(deleted_at=self.investigation.date_added)

        detail = self.serialize_detail()

        assert [block["id"] for block in detail["blocks"]] == [str(self.block.id)]

    def test_reports_no_template_for_a_manual_investigation(self) -> None:
        detail = self.serialize_detail()

        assert detail["template"] is None
        assert detail["source"]["type"] == "manual"
        assert detail["titleGeneration"] == {"status": None}

    def test_reports_the_template_that_created_the_investigation(self) -> None:
        self.investigation.update(template_key="breached_metric", template_version=1)

        detail = self.serialize_detail()

        assert detail["template"] == {"key": "breached_metric", "version": 1}

    def test_includes_block_output(self) -> None:
        execution = self.create_investigation_block_execution(
            block=self.block,
            executor="manual",
            block_version=1,
            input_fingerprint="f" * 64,
            status=InvestigationBlockExecutionStatus.COMPLETED,
            result={"schemaVersion": 1},
        )
        self.create_investigation_block_execution_project(execution=execution, project=self.project)
        self.block.update(current_execution=execution, result_execution=execution)

        assert self.serialize_detail()["blocks"][0]["outputStatus"] == "available"
        assert self.serialize_detail()["blocks"][0]["output"] == {"schemaVersion": 1}

    def test_query_count_is_constant_for_a_bare_queryset(self) -> None:
        def build(index: int) -> Investigation:
            investigation = self.create_investigation(
                organization=self.organization, title=f"Extra {index}"
            )
            self.create_investigation_project(investigation=investigation, project=self.project)
            block = self.create_investigation_block(investigation=investigation, position=0)
            execution = self.create_investigation_block_execution(
                block=block,
                executor="manual",
                block_version=1,
                input_fingerprint="f" * 64,
                status=InvestigationBlockExecutionStatus.COMPLETED,
                result={"schemaVersion": 1},
            )
            self.create_investigation_block_execution_project(
                execution=execution, project=self.project
            )
            block.update(
                current_execution=execution,
                content_execution=execution,
                result_execution=execution,
            )
            return investigation

        serializer = InvestigationDetailsSerializer()
        first = [build(0)]

        with CaptureQueriesContext(connection) as one:
            serialize(first, self.user, serializer)

        many_investigations = first + [build(index) for index in range(1, 5)]

        with CaptureQueriesContext(connection) as many:
            results = serialize(many_investigations, self.user, serializer)

        assert len(results) == 5
        assert len(many.captured_queries) == len(one.captured_queries)


class InvestigationActionRequestSerializationTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        kind = fake_action_kind()
        kind.start()
        self.addCleanup(kind.stop)
        self.detector = self.create_detector(project=self.project, type=MetricIssue.slug)
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Investigation"
        )
        self.orchestration_run = self.create_investigation_orchestration_run(
            investigation=self.investigation,
            source={"type": "breached_metric", "detectorId": str(self.detector.id)},
        )

    def action(self, **values: Any) -> dict[str, Any]:
        return {
            "kind": "update_detector",
            "detectorId": str(self.detector.id),
            "before": {"timeWindowSeconds": 300},
            "changes": {"timeWindowSeconds": 900},
            **values,
        }

    def add_request(self, key: str = "widen-window", **values: Any) -> InvestigationActionRequest:
        action = values.pop("action", self.action())
        return self.create_investigation_action_request(
            investigation=self.investigation,
            key=key,
            action_kind=action["kind"] if action else None,
            action_payload=action,
            **values,
        )

    def serialize_requests(self) -> list[dict[str, Any]]:
        access = from_user(self.user, self.organization)
        return serialize(
            self.investigation, self.user, InvestigationDetailsSerializer(access=access)
        )["actionRequests"]

    def test_serializes_an_action_request(self) -> None:
        action_request = self.add_request(
            impact="Fewer alerts.", primary=True, anchor_type="block", anchor_id="b-1"
        )

        assert self.serialize_requests() == [
            {
                "id": str(action_request.id),
                "key": "widen-window",
                "reportRevision": 0,
                "primary": True,
                "anchor": {"type": "block", "id": "b-1", "blockId": None},
                "title": "An action request",
                "rationale": "Because it helps.",
                "impact": "Fewer alerts.",
                "state": "suggested",
                "reason": None,
                "action": self.action(),
                "canApply": True,
                "cannotApplyReason": None,
                "appliedBy": None,
                "appliedDetails": None,
                "dateApplied": None,
                "error": None,
                "followUp": None,
                "dateCreated": action_request.date_added,
            }
        ]

    def add_followed_up_request(self, key: str = "widen-window", **command: Any) -> None:
        sent = self.create_investigation_orchestration_command(
            orchestration_run=self.orchestration_run,
            request_id=uuid4(),
            actor_id=self.user.id,
            expected_workflow_version=1,
            resulting_workflow_version=2,
            **{
                "type": "recheck_action_requests",
                "payload": {"reportRevision": 0, "source": {"type": "manual"}},
                **command,
            },
        )
        self.add_request(
            key,
            state=InvestigationActionRequestState.SUPERSEDED,
            error={"code": "stale", "current": {"timeWindowSeconds": 600}},
            followup_request_id=sent.request_id,
        )

    def test_shows_the_follow_up_sentry_sent(self) -> None:
        self.add_followed_up_request()

        (serialized,) = self.serialize_requests()

        assert serialized["followUp"] == {
            "status": "accepted",
            "reason": None,
            "rerun": None,
            "retryable": False,
        }

    def test_a_follow_up_seer_turned_down_has_seers_code(self) -> None:
        self.add_followed_up_request(
            status=InvestigationOrchestrationCommandStatus.FAILED,
            error={
                "code": "seer_command_dispatch_failed",
                "reason": "action_requests_report_changed",
                "retryable": False,
            },
        )

        (serialized,) = self.serialize_requests()

        assert serialized["followUp"] == {
            "status": "failed",
            "reason": "action_requests_report_changed",
            "rerun": None,
            "retryable": False,
        }

    def test_a_re_run_seer_dropped_says_so(self) -> None:
        self.add_followed_up_request(
            type="rerun_after_connection",
            payload={"provider": "datadog"},
            status=InvestigationOrchestrationCommandStatus.FAILED,
            rerun=InvestigationOrchestrationRerun.SKIPPED,
            error={"code": "rerun_skipped", "reason": "run_failed"},
        )

        (serialized,) = self.serialize_requests()

        assert serialized["followUp"] == {
            "status": "failed",
            "reason": "run_failed",
            "rerun": "skipped",
            "retryable": False,
        }

    def test_an_undelivered_follow_up_has_no_reason(self) -> None:
        self.add_followed_up_request(
            status=InvestigationOrchestrationCommandStatus.FAILED,
            error={"code": "seer_command_dispatch_failed", "retryable": True},
        )

        (serialized,) = self.serialize_requests()

        assert serialized["followUp"] == {
            "status": "failed",
            "reason": None,
            "rerun": None,
            "retryable": True,
        }

    def test_a_re_check_that_failed_behind_another_command_can_be_tried_again(self) -> None:
        self.add_followed_up_request(
            status=InvestigationOrchestrationCommandStatus.FAILED,
            error={"code": "earlier_command_conflicted"},
        )

        (serialized,) = self.serialize_requests()

        assert serialized["followUp"] == {
            "status": "failed",
            "reason": None,
            "rerun": None,
            "retryable": True,
        }

    def test_a_re_check_behind_an_undelivered_command_cannot_be_tried_again(self) -> None:
        self.add_followed_up_request(
            status=InvestigationOrchestrationCommandStatus.FAILED,
            error={"code": "earlier_command_failed"},
        )

        (serialized,) = self.serialize_requests()

        assert serialized["followUp"]["retryable"] is False

    def test_a_re_run_behind_a_conflict_can_be_tried_again_but_not_behind_a_failure(
        self,
    ) -> None:
        for key, code, retryable in (
            ("conflicted", "earlier_command_conflicted", True),
            ("failed", "earlier_command_failed", False),
        ):
            self.add_followed_up_request(
                key,
                type="rerun_after_connection",
                payload={"provider": "datadog"},
                status=InvestigationOrchestrationCommandStatus.FAILED,
                error={"code": code},
            )

        assert {row["key"]: row["followUp"]["retryable"] for row in self.serialize_requests()} == {
            "conflicted": True,
            "failed": False,
        }

    def test_block_anchors_point_at_the_live_block(self) -> None:
        live = self.create_investigation_block(
            investigation=self.investigation, position=0, stable_agent_key="cause"
        )
        self.create_investigation_block(
            investigation=self.investigation,
            position=1,
            stable_agent_key="removed",
            deleted_at=timezone.now(),
        )
        for key, anchor_id in [("live", "cause"), ("gone", "removed")]:
            self.add_request(key, anchor_type="block", anchor_id=anchor_id)
        self.add_request("hypothesis", anchor_type="hypothesis", anchor_id="h-1")
        self.add_request("same-id", anchor_type="hypothesis", anchor_id="cause")

        assert [row["anchor"] for row in self.serialize_requests()] == [
            {"type": "block", "id": "cause", "blockId": str(live.id)},
            {"type": "block", "id": "removed", "blockId": None},
            {"type": "hypothesis", "id": "h-1", "blockId": None},
            {"type": "hypothesis", "id": "cause", "blockId": None},
        ]

    def test_serializes_requests_without_a_known_action(self) -> None:
        self.add_request(action=None, primary=True)
        self.add_request("task", action={"kind": "seer_task", "prompt": "Add spans"})

        assert [
            (row["action"], row["canApply"], row["cannotApplyReason"])
            for row in self.serialize_requests()
        ] == [
            (None, False, "unsupported_action"),
            ({"kind": "seer_task", "prompt": "Add spans"}, False, "unsupported_action"),
        ]

    def test_orders_the_newest_report_first_and_omits_superseded_requests(self) -> None:
        old_primary = self.add_request(
            "old-primary",
            report_revision=0,
            primary=True,
            state=InvestigationActionRequestState.WITHDRAWN,
        )
        older = self.add_request("older", report_revision=0)
        self.add_request("superseded", state=InvestigationActionRequestState.SUPERSEDED)
        stale = self.add_request(
            "stale",
            report_revision=0,
            state=InvestigationActionRequestState.SUPERSEDED,
            error={"code": "stale", "current": {"timeWindowSeconds": 600}},
            followup_request_id=uuid4(),
        )
        self.add_request(
            "dropped-stale",
            report_revision=0,
            state=InvestigationActionRequestState.SUPERSEDED,
            error={"code": "stale", "current": {"timeWindowSeconds": 600}},
        )
        newer = self.add_request("newer", report_revision=1)
        primary = self.add_request("primary", report_revision=1, primary=True)

        assert [row["id"] for row in self.serialize_requests()] == [
            str(primary.id),
            str(newer.id),
            str(old_primary.id),
            str(older.id),
            str(stale.id),
        ]

    def test_serializes_who_applied_it_failures_and_withdrawals(self) -> None:
        now = timezone.now()
        self.add_request(
            state=InvestigationActionRequestState.APPLIED,
            applied_by_id=self.user.id,
            date_applied=now,
            applied_details={"provider": "datadog", "rerun": None},
        )
        self.add_request(
            "failed",
            state=InvestigationActionRequestState.FAILED,
            error={"code": "validation_failed", "detail": {"dataSources": ["Bad window."]}},
        )
        self.add_request(
            "withdrawn",
            state=InvestigationActionRequestState.WITHDRAWN,
            reason="The spikes are real.",
        )

        applied, failed, withdrawn = self.serialize_requests()

        assert applied["appliedBy"] is not None
        assert applied["appliedBy"]["id"] == str(self.user.id)
        assert applied["appliedDetails"] == {"provider": "datadog", "rerun": None}
        assert applied["dateApplied"] == now
        assert failed["state"] == "failed"
        assert failed["error"] == {
            "code": "validation_failed",
            "detail": {"dataSources": ["Bad window."]},
        }
        assert (withdrawn["state"], withdrawn["reason"]) == ("withdrawn", "The spikes are real.")
        assert withdrawn["cannotApplyReason"] == "not_suggested"

    def test_shows_no_applier_once_the_user_is_gone(self) -> None:
        self.add_request(
            state=InvestigationActionRequestState.APPLIED,
            applied_by_id=None,
            applied_details={"provider": "datadog", "rerun": None},
        )

        (applied,) = self.serialize_requests()

        assert applied["appliedBy"] is None

    def test_query_count_does_not_grow_with_action_requests(self) -> None:
        self.add_request("first-suggestion")
        self.add_request(
            state=InvestigationActionRequestState.APPLIED,
            applied_by_id=self.user.id,
            date_applied=timezone.now(),
            applied_details={"fields": ["highThreshold"]},
        )
        self.add_request("connect", action={"kind": "connect_telemetry", "provider": "datadog"})
        with CaptureQueriesContext(connection) as one:
            self.serialize_requests()

        other = self.create_user()
        self.add_request("second")
        self.add_request(
            "third",
            state=InvestigationActionRequestState.APPLIED,
            applied_by_id=other.id,
            date_applied=timezone.now(),
            applied_details={"fields": ["highThreshold"]},
        )
        self.add_request("connect-gcp", action={"kind": "connect_telemetry", "provider": "gcp"})
        for index in range(3):
            self.add_request(f"older-{index}", report_revision=1)
        with CaptureQueriesContext(connection) as many:
            assert len(self.serialize_requests()) == 9

        assert len(many.captured_queries) == len(one.captured_queries)

    def add_connect_request(self) -> None:
        self.add_request(
            "connect-datadog", action={"kind": "connect_telemetry", "provider": "datadog"}
        )

    @with_feature("organizations:seer-infra-telemetry")
    def test_a_manager_can_connect_a_provider_that_is_not_connected_yet(self) -> None:
        self.add_connect_request()

        (serialized,) = self.serialize_requests()

        assert (serialized["canApply"], serialized["cannotApplyReason"]) == (True, None)

    @with_feature("organizations:seer-infra-telemetry")
    def test_members_who_cannot_install_integrations_cannot_connect(self) -> None:
        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member")
        self.add_connect_request()

        assert self.cannot_apply_reason(member) == "permission_denied"

    def test_providers_cannot_be_connected_without_infra_telemetry(self) -> None:
        self.add_connect_request()

        assert self.cannot_apply_reason() == "unsupported_action"

    def serialize_for(self, user: Any) -> list[dict[str, Any]]:
        access = from_user(user, self.organization)
        return serialize(self.investigation, user, InvestigationDetailsSerializer(access=access))[
            "actionRequests"
        ]

    def cannot_apply_reason(self, user: Any = None) -> str | None:
        return self.serialize_for(user or self.user)[0]["cannotApplyReason"]

    def test_an_editor_can_apply_a_suggestion(self) -> None:
        self.add_request()

        (serialized,) = self.serialize_for(self.user)
        assert serialized["action"] == self.action()
        assert (serialized["canApply"], serialized["cannotApplyReason"]) == (True, None)

    def test_archived_investigations_cannot_apply(self) -> None:
        self.add_request()
        self.investigation.update(status=InvestigationStatus.ARCHIVED)

        assert self.cannot_apply_reason() == "investigation_archived"

    def test_requests_that_are_not_suggested_cannot_apply(self) -> None:
        self.add_request(state=InvestigationActionRequestState.FAILED)

        assert self.cannot_apply_reason() == "not_suggested"

    def test_unknown_action_kinds_cannot_apply(self) -> None:
        self.add_request(action={"kind": "seer_task", "prompt": "Add retry spans"})

        (serialized,) = self.serialize_for(self.user)
        assert serialized["action"] == {"kind": "seer_task", "prompt": "Add retry spans"}
        assert (serialized["canApply"], serialized["cannotApplyReason"]) == (
            False,
            "unsupported_action",
        )

    def test_the_kind_decides_suggested_requests(self) -> None:
        action_request = self.add_request(action=fake_action())
        access = from_user(self.user, self.organization)
        kind = ACTION_KINDS["test_kind"]
        assert isinstance(kind, RecordingKind)

        (serialized,) = serialize(
            self.investigation, self.user, InvestigationDetailsSerializer(access=access)
        )["actionRequests"]

        assert (serialized["canApply"], serialized["cannotApplyReason"]) == (True, None)
        assert kind.checked == [([action_request.id], [self.investigation.id], access, self.user)]

    def test_nothing_can_apply_without_access(self) -> None:
        action_request = self.add_request(action=fake_action())
        kind = ACTION_KINDS["test_kind"]
        assert isinstance(kind, RecordingKind)

        serialized = serialize(action_request, self.user)

        assert (serialized["canApply"], serialized["cannotApplyReason"]) == (False, "no_access")
        assert kind.checked == []

    def test_dynamic_monitors_cannot_apply(self) -> None:
        self.add_request()
        self.detector.update(config={"detection_type": "dynamic"})

        assert self.cannot_apply_reason() == "dynamic_detector"

    def test_each_suggestion_gets_the_reason_for_its_own_monitor(self) -> None:
        other = self.create_detector(project=self.project, type=MetricIssue.slug)
        self.add_request("own-monitor")
        self.add_request("other-monitor", action=self.action(detectorId=str(other.id)))

        reasons = {row["key"]: row["cannotApplyReason"] for row in self.serialize_for(self.user)}

        assert reasons == {"own-monitor": None, "other-monitor": "not_target_detector"}

    def test_only_the_source_detector_can_be_changed(self) -> None:
        other = self.create_detector(project=self.project, type=MetricIssue.slug)
        self.add_request(action=self.action(detectorId=str(other.id)))

        assert self.cannot_apply_reason() == "not_target_detector"

    def test_missing_detectors_cannot_apply(self) -> None:
        self.add_request()
        self.detector.update(status=ObjectStatus.PENDING_DELETION)

        assert self.cannot_apply_reason() == "detector_not_found"

    def test_detectors_in_other_organizations_cannot_apply(self) -> None:
        other_project = self.create_project(organization=self.create_organization())
        foreign = self.create_detector(project=other_project, type=MetricIssue.slug)
        self.investigation.orchestration_run.update(
            source={"type": "breached_metric", "detectorId": str(foreign.id)}
        )
        self.add_request(action=self.action(detectorId=str(foreign.id)))

        assert self.cannot_apply_reason() == "detector_not_found"

    def test_users_who_cannot_edit_the_detector_cannot_apply(self) -> None:
        self.organization.update_option("sentry:alerts_member_write", False)
        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member")
        self.add_request()

        assert self.cannot_apply_reason(member) == "permission_denied"

    @with_feature("organizations:team-roles")
    def test_query_count_does_not_grow_with_suggestions(self) -> None:
        self.organization.update_option("sentry:alerts_member_write", False)
        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member")
        team = self.create_team(organization=self.organization)
        self.project.add_team(team)
        self.create_team_membership(team=team, user=member, role="admin")
        self.add_request()
        self.add_followed_up_request("followed-up")
        with CaptureQueriesContext(connection) as one:
            serialized = {item["key"]: item for item in self.serialize_for(member)}
        assert serialized["widen-window"]["canApply"] is True

        self.add_followed_up_request("second-followed-up")
        self.add_request("second")
        self.add_request("third")
        for index in range(5):
            self.add_request(f"applied-{index}", state=InvestigationActionRequestState.APPLIED)
        with CaptureQueriesContext(connection) as many:
            assert len(self.serialize_for(member)) == 10

        assert len(many.captured_queries) == len(one.captured_queries)
