from unittest.mock import patch

import pytest

from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.models.night_shift import SeerNightShiftRun
from sentry.seer.monitor_cleanup import FEATURE, MonitorCleanupArtifact, validate_monitor_cleanup
from sentry.tasks.seer.monitor_cleanup import collect_monitor_cleanup_result, finish_shard
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options


class SeerAdminNightShiftTriggerTest(APITestCase):
    endpoint = "sentry-admin-seer-night-shift-trigger"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(is_staff=True)
        self.organization = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

    def get_response(self, *args, **params):
        with patch("sentry.api.permissions.is_active_staff", return_value=True):
            return super().get_response(*args, **params)

    def test_trigger_night_shift(self) -> None:
        with patch(
            "sentry.seer.endpoints.admin_night_shift_trigger.run_night_shift_for_org"
        ) as mock_task:
            response = self.get_success_response(
                organization_id=self.organization.id,
                status_code=200,
            )

        assert response.data["success"] is True
        assert response.data["organization_id"] == self.organization.id
        assert response.data["max_candidates"] is None
        mock_task.apply_async.assert_called_once_with(
            args=[self.organization.id],
            kwargs={
                "options": {"source": "manual", "dry_run": False},
                "execute_in_task": True,
            },
        )

    def test_trigger_with_max_candidates_override(self) -> None:
        with patch(
            "sentry.seer.endpoints.admin_night_shift_trigger.run_night_shift_for_org"
        ) as mock_task:
            response = self.get_success_response(
                organization_id=self.organization.id,
                max_candidates=3,
                dry_run=True,
                status_code=200,
            )

        assert response.data["max_candidates"] == 3
        mock_task.apply_async.assert_called_once_with(
            args=[self.organization.id],
            kwargs={
                "options": {"source": "manual", "dry_run": True, "max_candidates": 3},
                "execute_in_task": True,
            },
        )

    def test_trigger_rejects_invalid_max_candidates(self) -> None:
        response = self.get_response(
            organization_id=self.organization.id,
            max_candidates="not-a-number",
        )
        assert response.status_code == 400
        assert response.data["detail"] == "max_candidates must be a valid integer"

    def test_trigger_rejects_non_positive_max_candidates(self) -> None:
        for value in (0, -1):
            response = self.get_response(
                organization_id=self.organization.id,
                max_candidates=value,
            )
            assert response.status_code == 400, value
            assert response.data["detail"] == "max_candidates must be >= 1"

    def test_missing_organization_id_triggers_full_schedule(self) -> None:
        with patch(
            "sentry.seer.endpoints.admin_night_shift_trigger.schedule_night_shift"
        ) as mock_schedule:
            response = self.get_success_response(status_code=200)

        assert response.data["success"] is True
        assert response.data["organization_id"] is None
        mock_schedule.apply_async.assert_called_once_with(
            kwargs={"run_options": {"source": "manual", "dry_run": False}},
        )

    def test_full_schedule_forwards_overrides(self) -> None:
        with patch(
            "sentry.seer.endpoints.admin_night_shift_trigger.schedule_night_shift"
        ) as mock_schedule:
            response = self.get_success_response(dry_run=True, max_candidates=5, status_code=200)

        assert response.data["organization_id"] is None
        assert response.data["dry_run"] is True
        assert response.data["max_candidates"] == 5
        mock_schedule.apply_async.assert_called_once_with(
            kwargs={
                "run_options": {"source": "manual", "dry_run": True, "max_candidates": 5},
            },
        )

    def test_invalid_organization_id(self) -> None:
        response = self.get_response(organization_id="not-a-number")
        assert response.status_code == 400
        assert response.data["detail"] == "organization_id must be a valid integer"

    def test_rejects_explicit_null_organization_id(self) -> None:
        # Frontend may serialize NaN to null when a non-numeric value is typed.
        # Treat that as a 400 rather than silently fanning out to every org.
        response = self.get_response(organization_id=None)
        assert response.status_code == 400
        assert response.data["detail"] == "organization_id must be a valid integer"

    def test_rejects_empty_string_organization_id(self) -> None:
        response = self.get_response(organization_id="")
        assert response.status_code == 400
        assert response.data["detail"] == "organization_id must be a valid integer"

    def test_requires_staff(self) -> None:
        non_staff_user = self.create_user(is_staff=False)
        self.login_as(user=non_staff_user)
        response = super().get_response(organization_id=self.organization.id)
        assert response.status_code == 403


class SeerAdminMonitorCleanupTriggerTest(APITestCase):
    endpoint = "sentry-admin-seer-monitor-cleanup-trigger"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_options({"staff.ga-rollout": True}))
        self.user = self.create_user(is_staff=True)
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.keep = self.create_detector(project=self.project, type="metric_issue", name="Keep")
        self.duplicate = self.create_detector(
            project=self.project, type="metric_issue", name="Copy"
        )
        self.login_as(self.user)

    def trigger(self):
        with (
            self.feature(FEATURE),
            patch("sentry.api.permissions.is_active_staff", return_value=True),
            patch("sentry.seer.endpoints.admin_monitor_cleanup_trigger.dispatch_run"),
            self.tasks(),
        ):
            return self.get_success_response(organizationId=self.organization.id, status_code=202)

    def artifact(self, duplicate_id: str | None = None):
        return MonitorCleanupArtifact(
            scan_status="complete",
            monitors_scanned=2,
            summary="One duplicate group",
            groups=[
                {
                    "suggested_keep_id": str(self.keep.id),
                    "duplicate_ids": [duplicate_id or str(self.duplicate.id)],
                    "reason": "Matching configuration",
                    "matching_settings": [{"label": "Trigger", "value": "More than 100 errors"}],
                }
            ],
        )

    def test_trigger_creates_manual_run_and_shard(self) -> None:
        response = self.trigger()
        run = SeerNightShiftRun.objects.get(id=response.data["runId"])
        assert run.schedule_id is None
        assert run.extras["triggering_user_id"] == self.user.id
        assert run.workflow_config.strategy == "duplicate_monitors"
        assert run.workflow_config.enabled is False
        assert run.shards.get().extras["project_id"] == self.project.id
        assert f"runId={run.id}" in response.data["url"]

    def test_requires_feature(self) -> None:
        with patch("sentry.api.permissions.is_active_staff", return_value=True):
            self.get_error_response(organizationId=self.organization.id, status_code=404)

    def test_requires_staff(self) -> None:
        self.login_as(self.create_user())
        with self.feature(FEATURE):
            self.get_error_response(organizationId=self.organization.id, status_code=403)

    def test_requires_organization(self) -> None:
        with patch("sentry.api.permissions.is_active_staff", return_value=True):
            self.get_error_response(status_code=400)

    def test_requires_organization_access(self) -> None:
        other = self.create_organization()
        with (
            self.feature(FEATURE),
            patch("sentry.api.permissions.is_active_staff", return_value=True),
        ):
            self.get_error_response(organizationId=other.id, status_code=403)

    def test_validates_and_persists_result_once(self) -> None:
        run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
        output = validate_monitor_cleanup(self.artifact(), self.organization.id, self.project.id)
        shard = run.shards.get()
        finish_shard(shard.id, output=output)
        finish_shard(shard.id, error="Late failure must not replace a completed result")
        run.refresh_from_db()
        assert run.results.count() == 1
        assert run.extras["status"] == "complete"
        assert run.date_completed is not None
        assert run.results.get().extras["groups"][0]["keep"]["name"] == "Keep"

    def test_completion_persists_chat_artifact(self) -> None:
        run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
        seer_run = self.create_seer_run(organization=self.organization, seer_run_state_id=123)
        run.shards.get().update(seer_run=seer_run)
        state = SeerRunState(
            run_id=123,
            status="completed",
            updated_at="2026-09-09T00:00:00Z",
            blocks=[
                {
                    "id": "output",
                    "timestamp": "2026-09-09T00:00:00Z",
                    "message": {"role": "assistant", "content": "Done"},
                    "artifacts": [
                        {
                            "key": "monitor_cleanup",
                            "data": self.artifact().dict(),
                            "reason": "Scan complete",
                        }
                    ],
                }
            ],
        )
        with patch("sentry.tasks.seer.monitor_cleanup.SeerAgentClient") as client:
            client.return_value.get_run.return_value = state
            collect_monitor_cleanup_result(self.organization.id, 123)
        result = run.results.get()
        assert result.result_seer_run_id == seer_run.id
        assert result.extras["projectSlug"] == self.project.slug
        assert result.extras["groups"][0]["matchingSettings"] == [
            {"label": "Trigger", "value": "More than 100 errors"}
        ]
        assert result.extras["groups"][0]["duplicates"][0]["id"] == str(self.duplicate.id)

    def test_completed_chat_without_artifact_fails(self) -> None:
        run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
        seer_run = self.create_seer_run(organization=self.organization, seer_run_state_id=123)
        run.shards.get().update(seer_run=seer_run)
        state = SeerRunState(
            run_id=123, status="completed", updated_at="2026-09-09T00:00:00Z", blocks=[]
        )
        with patch("sentry.tasks.seer.monitor_cleanup.SeerAgentClient") as client:
            client.return_value.get_run.return_value = state
            collect_monitor_cleanup_result(self.organization.id, 123)
        run.refresh_from_db()
        assert run.extras["status"] == "failed"
        assert not run.results.exists()

    def test_accepts_active_superuser_before_staff_rollout(self) -> None:
        with (
            override_options({"staff.ga-rollout": False}),
            patch("sentry.api.permissions.is_active_superuser", return_value=True),
        ):
            assert self.trigger().status_code == 202

    def test_rejects_cross_project_candidates(self) -> None:
        other_project = self.create_project(organization=self.organization)
        other = self.create_detector(project=other_project, type="metric_issue")
        with pytest.raises(ValueError, match="outside this project"):
            validate_monitor_cleanup(
                self.artifact(str(other.id)), self.organization.id, self.project.id
            )

    def test_rejects_survivor_as_duplicate(self) -> None:
        with pytest.raises(ValueError, match="overlapping"):
            validate_monitor_cleanup(
                self.artifact(str(self.keep.id)), self.organization.id, self.project.id
            )

    def test_history_does_not_expose_inaccessible_projects(self) -> None:
        run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        self.login_as(member)
        with self.feature(FEATURE):
            response = self.client.get(
                f"/api/0/organizations/{self.organization.slug}/seer/workflows/", {"runId": run.id}
            )
        assert response.status_code == 200
        assert response.data == []

    def finding_artifact(self, **overrides):
        finding = {
            "kind": "overlapping_coverage",
            "monitor_ids": [str(self.keep.id), str(self.duplicate.id)],
            "reason": "Queries overlap but thresholds differ.",
            "example": "A burst of timeout errors can trigger both monitors.",
            "next_step": "Review whether the separate thresholds are intentional.",
            **overrides,
        }
        return MonitorCleanupArtifact(
            scan_status="complete",
            monitors_scanned=2,
            summary="Overlapping coverage",
            findings=[finding],
        )

    def test_overlap_has_no_keeper(self) -> None:
        output = validate_monitor_cleanup(
            self.finding_artifact(), self.organization.id, self.project.id
        )
        assert output["schemaVersion"] == 2
        assert output["findings"][0]["suggestedKeepId"] is None
        assert output["findings"][0]["monitors"][0]["name"] == "Keep"

    def test_overlap_cannot_suggest_deletion(self) -> None:
        with pytest.raises(ValueError, match="must not recommend deletion"):
            validate_monitor_cleanup(
                self.finding_artifact(suggested_keep_id=str(self.keep.id)),
                self.organization.id,
                self.project.id,
            )

    def test_exact_finding_requires_member_as_keeper(self) -> None:
        with pytest.raises(ValueError, match="suggested keeper"):
            validate_monitor_cleanup(
                self.finding_artifact(kind="exact_duplicate"), self.organization.id, self.project.id
            )

    def test_allows_coverage_and_notifications_for_same_pair(self) -> None:
        workflow = self.create_workflow(
            organization=self.organization, name="Shared alert", enabled=False
        )
        self.create_detector_workflow(detector=self.keep, workflow=workflow)
        self.create_detector_workflow(detector=self.duplicate, workflow=workflow)
        artifact = self.finding_artifact()
        artifact.findings += self.finding_artifact(
            kind="duplicate_notifications", alert_ids=[str(workflow.id)]
        ).findings
        output = validate_monitor_cleanup(artifact, self.organization.id, self.project.id)
        assert len(output["findings"]) == 2
        assert output["findings"][1]["alerts"] == [
            {"id": str(workflow.id), "name": "Shared alert", "enabled": False}
        ]

    def test_rejects_alert_not_connected_to_both_monitors(self) -> None:
        workflow = self.create_workflow(organization=self.organization)
        self.create_detector_workflow(detector=self.keep, workflow=workflow)
        with pytest.raises(ValueError, match="alerts connected"):
            validate_monitor_cleanup(
                self.finding_artifact(kind="duplicate_notifications", alert_ids=[str(workflow.id)]),
                self.organization.id,
                self.project.id,
            )

    def test_rejects_cross_organization_alert(self) -> None:
        workflow = self.create_workflow(organization=self.create_organization())
        with pytest.raises(ValueError, match="alerts connected"):
            validate_monitor_cleanup(
                self.finding_artifact(kind="duplicate_notifications", alert_ids=[str(workflow.id)]),
                self.organization.id,
                self.project.id,
            )

    def test_rejects_repeated_finding(self) -> None:
        artifact = self.finding_artifact()
        artifact.findings *= 2
        with pytest.raises(ValueError, match="overlapping"):
            validate_monitor_cleanup(artifact, self.organization.id, self.project.id)

    def test_persists_comparison_values_by_monitor(self) -> None:
        artifact = self.finding_artifact(
            comparison=[
                {
                    "property": "Trigger",
                    "values": [
                        {"monitor_id": str(self.keep.id), "value": ">100 errors"},
                        {"monitor_id": str(self.duplicate.id), "value": ">500 errors"},
                    ],
                }
            ]
        )
        output = validate_monitor_cleanup(artifact, self.organization.id, self.project.id)
        assert output["findings"][0]["comparison"] == [
            {
                "property": "Trigger",
                "values": [
                    {"monitorId": str(self.keep.id), "value": ">100 errors"},
                    {"monitorId": str(self.duplicate.id), "value": ">500 errors"},
                ],
            }
        ]

    def test_rejects_incomplete_or_foreign_comparison_columns(self) -> None:
        artifact = self.finding_artifact(
            comparison=[
                {
                    "property": "Trigger",
                    "values": [
                        {"monitor_id": str(self.keep.id), "value": ">100 errors"},
                        {"monitor_id": "999999", "value": ">500 errors"},
                    ],
                }
            ]
        )
        with pytest.raises(ValueError, match="each finding monitor exactly once"):
            validate_monitor_cleanup(artifact, self.organization.id, self.project.id)
