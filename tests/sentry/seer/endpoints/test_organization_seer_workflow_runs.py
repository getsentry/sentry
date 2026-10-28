from collections.abc import Sequence
from datetime import timedelta
from unittest.mock import patch

from django.db import connections, router
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from openapi_schema_validator import OAS30Validator

from sentry.apidocs.examples.seer_workflow_examples import WORKFLOW_RUNS_RESPONSE
from sentry.apidocs.spectacular_ports import resolve_type_hint
from sentry.constants import ObjectStatus
from sentry.db.models.fields.bounded import I64_MAX
from sentry.hybridcloud.models.outbox import CellOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.seer.endpoints.organization_seer_workflow_configs import serialize_workflow_configs
from sentry.seer.endpoints.organization_seer_workflow_runs import (
    SeerWorkflowRunsResponse,
    WorkflowRunListErrorResponse,
    serialize_workflow_runs,
)
from sentry.seer.models.run import SeerAgentRun
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowExecutionStatus,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowRunStatus,
    SeerWorkflowStrategy,
)
from sentry.seer.monitor_cleanup.runs import deliver_monitor_cleanup_result
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.features import with_feature


@override_settings(SENTRY_SELF_HOSTED=False)
@with_feature("organizations:seer-automations")
class OrganizationSeerWorkflowRunsTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-workflow-runs"

    def setUp(self) -> None:
        super().setUp()
        self.config = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
            filters={"all_projects": True},
        )
        self.login_as(self.user)

    def test_returns_run_lifecycle_and_all_executions(self) -> None:
        run = self.create_run(status=SeerWorkflowRunStatus.RUNNING, trigger_key="issue_created:123")
        seer_run = Factories.create_seer_run(self.organization)
        completed = Factories.create_seer_workflow_run_execution(
            run,
            seer_run=seer_run,
            status=SeerWorkflowExecutionStatus.COMPLETE,
            date_completed=timezone.now(),
            extras={"error": None, "result": "noop"},
        )
        error = {"code": "dispatch_failed", "message": "Could not start execution."}
        failed = Factories.create_seer_workflow_run_execution(
            run,
            status=SeerWorkflowExecutionStatus.FAILED,
            date_completed=timezone.now(),
            extras={"error": error},
        )
        queued = Factories.create_seer_workflow_run_execution(
            run, status=SeerWorkflowExecutionStatus.QUEUED
        )

        response = self.get_success_response(self.organization.slug, config=self.config.id)

        assert response.data == {
            "runs": [
                {
                    "id": str(run.id),
                    "configId": str(self.config.id),
                    "status": "running",
                    "dateAdded": run.date_added,
                    "dateUpdated": run.date_updated,
                    "dateCompleted": None,
                    "executions": [
                        {
                            "id": str(completed.id),
                            "seerRunId": str(seer_run.uuid),
                            "status": "complete",
                            "dateAdded": completed.date_added,
                            "dateUpdated": completed.date_updated,
                            "dateCompleted": completed.date_completed,
                        },
                        {
                            "id": str(failed.id),
                            "seerRunId": None,
                            "status": "failed",
                            "dateAdded": failed.date_added,
                            "dateUpdated": failed.date_updated,
                            "dateCompleted": failed.date_completed,
                            "error": error,
                        },
                        {
                            "id": str(queued.id),
                            "seerRunId": None,
                            "status": "queued",
                            "dateAdded": queued.date_added,
                            "dateUpdated": queued.date_updated,
                            "dateCompleted": None,
                        },
                    ],
                }
            ]
        }

    def test_exposes_only_allowlisted_error_fields_from_extras(self) -> None:
        private_value = "internal-metadata-canary"
        error = {"code": "dispatch_failed", "message": "Could not start execution."}
        run = self.create_run(
            status=SeerWorkflowRunStatus.FAILED,
            extras={
                "snapshot": {"inputs": {"secret": private_value}},
                "private": private_value,
                "error": {**error, "debug": {"secret": private_value}},
            },
        )
        Factories.create_seer_workflow_run_execution(
            run,
            status=SeerWorkflowExecutionStatus.FAILED,
            extras={
                "result": {"secret": private_value},
                "private": private_value,
                "error": {**error, "debug": {"secret": private_value}},
            },
        )

        response = self.get_success_response(self.organization.slug, config=self.config.id)
        (serialized_run,) = response.json()["runs"]
        (serialized_execution,) = serialized_run["executions"]
        assert serialized_run["status"] == serialized_execution["status"] == "failed"
        assert serialized_run["error"] == error
        assert serialized_execution["error"] == error
        assert "extras" not in serialized_run
        assert "extras" not in serialized_execution
        assert private_value not in response.content.decode()

    def test_missing_or_malformed_errors_use_safe_fallback(self) -> None:
        run = self.create_run(status=SeerWorkflowRunStatus.FAILED)
        execution = Factories.create_seer_workflow_run_execution(
            run, status=SeerWorkflowExecutionStatus.FAILED
        )
        for error in (
            None,
            "internal-error-canary",
            {"code": 123, "message": "Could not start execution."},
            {"code": "dispatch_failed", "message": {"secret": "internal-error-canary"}},
        ):
            run.update(extras={"error": error})
            execution.update(extras={"error": error})
            response = self.get_success_response(self.organization.slug, config=self.config.id)
            (serialized_run,) = response.json()["runs"]
            assert serialized_run["error"] == {
                "code": "unknown",
                "message": "No error details are available.",
            }
            assert serialized_run["executions"][0]["error"] == serialized_run["error"]
            assert "internal-error-canary" not in response.content.decode()

    def test_rejected_run_returns_error_variant(self) -> None:
        error = {"code": "quota_exceeded", "message": "Automation quota exceeded."}
        completed_at = timezone.now()
        self.create_run(
            status=SeerWorkflowRunStatus.REJECTED,
            date_completed=completed_at,
            extras={"error": error},
        )

        response = self.get_success_response(self.organization.slug, config=self.config.id)
        (rejected,) = response.data["runs"]
        assert rejected["status"] == "rejected"
        assert rejected["dateCompleted"] == completed_at
        assert rejected["error"] == error
        assert rejected["executions"] == []

    def test_non_error_records_omit_stale_errors(self) -> None:
        error = {"code": "internal-only", "message": "Internal error canary"}
        for status in ("queued", "running", "complete", None):
            run = self.create_run(status=status, extras={"error": error})
            Factories.create_seer_workflow_run_execution(
                run, status=status, extras={"error": error}
            )

        response = self.get_success_response(self.organization.slug, config=self.config.id)
        runs = response.json()["runs"]
        assert [run["status"] for run in runs] == [None, "complete", "running", "queued"]
        for run_data in runs:
            assert "error" not in run_data
            assert "error" not in run_data["executions"][0]
            assert run_data["executions"][0]["status"] == run_data["status"]

    def test_openapi_examples_match_response_contracts(self) -> None:
        success, failure, invalid_filter = WORKFLOW_RUNS_RESPONSE
        validator = OAS30Validator(
            resolve_type_hint(SeerWorkflowRunsResponse),
            format_checker=OAS30Validator.FORMAT_CHECKER,
        )
        validator.validate(success.value)
        validator.validate(failure.value)
        OAS30Validator(resolve_type_hint(WorkflowRunListErrorResponse)).validate(
            invalid_filter.value
        )

    def test_lists_runs_across_configs(self) -> None:
        older = self.create_run()
        other_config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        )
        newer = Factories.create_seer_workflow_run(
            self.organization, workflow_config=other_config, status=SeerWorkflowRunStatus.QUEUED
        )
        foreign_org = self.create_organization(owner=self.user)
        foreign_config = Factories.create_seer_workflow_config(
            foreign_org, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        )
        Factories.create_seer_workflow_run(foreign_org, workflow_config=foreign_config)
        Factories.create_seer_workflow_run(self.organization, workflow_config=foreign_config)
        Factories.create_seer_workflow_run(foreign_org, workflow_config=self.config)
        legacy_config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE
        )
        Factories.create_seer_workflow_run(self.organization, workflow_config=legacy_config)
        Factories.create_seer_workflow_run(self.organization)

        first = self.get_success_response(self.organization.slug, per_page=1)
        assert [(run["id"], run["configId"]) for run in first.data["runs"]] == [
            (str(newer.id), str(other_config.id))
        ]
        links = parse_link_header(first.headers["Link"])
        next_url = next(url for url, link in links.items() if link["rel"] == "next")
        second = self.client.get(next_url)
        assert second.status_code == 200
        assert [(run["id"], run["configId"]) for run in second.data["runs"]] == [
            (str(older.id), str(self.config.id))
        ]
        assert (
            next(
                link
                for link in parse_link_header(second.headers["Link"]).values()
                if link["rel"] == "next"
            )["results"]
            == "false"
        )

    def test_config_and_organization_scope_apply_before_pagination(self) -> None:
        same_time = timezone.now()
        older = self.create_run()
        newer = self.create_run()
        older.update(date_added=same_time)
        newer.update(date_added=same_time)
        other_config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
        )
        Factories.create_seer_workflow_run(self.organization, workflow_config=other_config)
        Factories.create_seer_workflow_run(self.create_organization(), workflow_config=self.config)

        first = self.get_success_response(self.organization.slug, config=self.config.id, per_page=1)
        assert [run["id"] for run in first.data["runs"]] == [str(newer.id)]
        links = parse_link_header(first.headers["Link"])
        next_url = next(url for url, link in links.items() if link["rel"] == "next")
        assert f"config={self.config.id}" in next_url
        second = self.client.get(next_url)
        assert second.status_code == 200
        assert [run["id"] for run in second.data["runs"]] == [str(older.id)]
        assert (
            next(
                link
                for link in parse_link_header(second.headers["Link"]).values()
                if link["rel"] == "next"
            )["results"]
            == "false"
        )

    def test_feature_disabled_returns_404(self) -> None:
        with self.feature(
            {
                "organizations:seer-automations": False,
                "organizations:seer-night-shift": True,
                "organizations:seer-workflows-monitor-cleanup": True,
            }
        ):
            self.get_error_response(self.organization.slug, config=self.config.id, status_code=404)
            self.get_error_response(self.organization.slug, status_code=404)

    def test_invalid_config_filter(self) -> None:
        for config_id in ("invalid", "0", str(I64_MAX + 1)):
            response = self.get_error_response(
                self.organization.slug, config=config_id, status_code=400
            )
            assert "config" in response.data["detail"]

    def test_repeated_config_filter(self) -> None:
        response = self.get_error_response(
            self.organization.slug, config=[self.config.id, self.config.id], status_code=400
        )
        assert response.data == {"detail": "Supply only one config."}

    def test_unknown_config_returns_empty_history(self) -> None:
        self.create_run()
        response = self.get_success_response(self.organization.slug, config=I64_MAX)
        assert response.data == {"runs": []}

    def test_foreign_and_legacy_configs_are_not_available(self) -> None:
        foreign_org = self.create_organization(owner=self.user)
        foreign_config = Factories.create_seer_workflow_config(
            foreign_org, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        )
        Factories.create_seer_workflow_run(foreign_org, workflow_config=foreign_config)
        response = self.get_success_response(self.organization.slug, config=foreign_config.id)
        assert response.data == {"runs": []}
        legacy = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE
        )
        response = self.get_success_response(self.organization.slug, config=legacy.id)
        assert response.data == {"runs": []}

    def test_requires_organization_membership(self) -> None:
        self.login_as(self.create_user())
        self.get_error_response(self.organization.slug, config=self.config.id, status_code=403)

    def test_project_visibility_uses_the_original_run_scope(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        team = self.create_team(organization=self.organization)
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[team])
        visible_project = self.create_project(teams=[team])
        hidden_project = self.create_project(
            teams=[self.create_team(organization=self.organization)]
        )
        visible = self.create_run(project_ids=[visible_project.id])
        self.create_run(project_ids=[hidden_project.id])
        self.create_run(project_ids=[visible_project.id, hidden_project.id])
        self.create_run(extras={})
        empty = self.create_run(project_ids=[])
        self.config.update(filters={"all_projects": False})
        Factories.create_seer_workflow_config_project(self.config, hidden_project)
        self.login_as(member)

        response = self.get_success_response(
            self.organization.slug, config=self.config.id, per_page=1
        )
        assert [run["id"] for run in response.data["runs"]] == [str(empty.id)]
        links = parse_link_header(response.headers["Link"])
        next_url = next(url for url, link in links.items() if link["rel"] == "next")
        assert f"config={self.config.id}" in next_url
        next_page = self.client.get(next_url)
        assert next_page.status_code == 200
        assert [run["id"] for run in next_page.data["runs"]] == [str(visible.id)]
        assert (
            next(
                link
                for link in parse_link_header(next_page.headers["Link"]).values()
                if link["rel"] == "next"
            )["results"]
            == "false"
        )

        unfiltered = self.get_success_response(self.organization.slug)
        assert [run["id"] for run in unfiltered.data["runs"]] == [str(empty.id), str(visible.id)]

    def test_does_not_expose_a_foreign_seer_run_link(self) -> None:
        run = self.create_run()
        foreign_seer_run = Factories.create_seer_run(self.create_organization())
        execution = Factories.create_seer_workflow_run_execution(run, seer_run=foreign_seer_run)

        response = self.get_success_response(self.organization.slug, config=self.config.id)
        assert response.data["runs"][0]["executions"][0]["id"] == str(execution.id)
        assert response.data["runs"][0]["executions"][0]["seerRunId"] is None

    def test_execution_serialization_batches_database_reads(self) -> None:
        runs = [self.create_run() for _ in range(3)]
        for run in runs:
            Factories.create_seer_workflow_run_execution(
                run, seer_run=Factories.create_seer_run(self.organization)
            )
            Factories.create_seer_workflow_run_execution(run)
        using = router.db_for_read(SeerWorkflowRunExecution)
        with CaptureQueriesContext(connections[using]) as queries:
            result = serialize_workflow_runs(runs)

        assert len(queries) == 1
        assert [len(run["executions"]) for run in result["runs"]] == [2, 2, 2]
        assert result["runs"][0]["executions"][0]["seerRunId"] is not None

    def create_run(self, *, project_ids: Sequence[int] | None = None, **kwargs) -> SeerWorkflowRun:
        kwargs.setdefault("status", SeerWorkflowRunStatus.QUEUED)
        kwargs.setdefault(
            "extras",
            {
                "snapshot": {
                    "config_version": self.config.version,
                    "strategy": self.config.strategy,
                    "filters": self.config.filters,
                    "project_ids": list(project_ids)
                    if project_ids is not None
                    else [self.project.id],
                    "output_policy": self.config.output_policy,
                    "inputs": {},
                },
                "error": None,
            },
        )
        return Factories.create_seer_workflow_run(
            self.organization, workflow_config=self.config, **kwargs
        )


@override_settings(SENTRY_SELF_HOSTED=False)
class OrganizationSeerMonitorCleanupTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-workflow-runs"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        rate_limit_patcher = patch(
            "sentry.middleware.ratelimit.get_rate_limit_value", return_value=None
        )
        rate_limit_patcher.start()
        self.addCleanup(rate_limit_patcher.stop)
        self.keep = self.create_detector(project=self.project, type="metric_issue", name="Keep")
        self.duplicate = self.create_detector(
            project=self.project, type="metric_issue", name="Copy"
        )
        self.login_as(self.user)

    def test_scan_stores_findings(self) -> None:
        run = self.trigger()
        assert run.source == "monitor_cleanup"
        assert run.extras["source"] == "manual"
        outbox = CellOutbox.objects.get(
            category=OutboxCategory.SEER_RUN_CREATE, object_identifier=run.run_id
        )
        assert outbox.payload is not None
        assert outbox.payload["body"]["payload"] == {"response_version": 1}
        result = self.result()
        result["data"]["projects"][0]["scan_status"] = "partial"
        findings = result["data"]["projects"][0]["findings"]
        findings.extend(
            [
                {**findings[0], "monitor_ids": [str(self.keep.id), "999999"]},
                {**findings[0], "alert_ids": ["999999"]},
            ]
        )
        deliver_monitor_cleanup_result(
            self.organization.id, run.run.uuid, "completed", result, None
        )
        run.refresh_from_db()
        assert run.run.workflow_execution.run.date_completed is not None
        assert run.extras["status"] == "partial"
        assert len(run.extras["results"]) == 1
        (finding,) = run.extras["results"][0]["findings"]
        assert finding["suggestedKeepId"] == str(self.keep.id)
        assert finding["monitors"] == [
            {"id": str(self.keep.id), "name": "Keep", "enabled": self.keep.enabled},
            {"id": str(self.duplicate.id), "name": "Copy", "enabled": self.duplicate.enabled},
        ]

    def test_invalid_results_report_safe_errors(self) -> None:
        run = self.trigger()
        deliver_monitor_cleanup_result(
            self.organization.id, run.run.uuid, "completed", {"schema_version": 1, "data": {}}, None
        )
        run.refresh_from_db()
        assert run.extras["status"] == "failed"
        assert not run.extras["results"]
        assert run.extras["error"] == "Seer returned results that could not be loaded."

        run = self.trigger()
        result = self.result()
        result["data"]["projects"][0]["project_id"] = "999999999"
        deliver_monitor_cleanup_result(
            self.organization.id, run.run.uuid, "completed", result, None
        )
        run.refresh_from_db()
        assert run.extras["status"] == "failed"
        assert run.extras["error"] == "Some scanned projects are no longer accessible."

    def test_requires_feature_and_seer_access(self) -> None:
        with patch("sentry.seer.monitor_cleanup.runs.ratelimits.is_limited") as limit:
            self.get_error_response(
                self.organization.slug, strategy="duplicate_monitors", status_code=404
            )
            with (
                override_settings(SENTRY_SELF_HOSTED=True),
                self.feature("organizations:seer-workflows-monitor-cleanup"),
            ):
                response = self.get_error_response(
                    self.organization.slug, strategy="duplicate_monitors", status_code=403
                )
            assert response.data == {"detail": "Seer is not available for this organization."}
            limit.assert_not_called()

            limit.return_value = True
            with self.feature("organizations:seer-workflows-monitor-cleanup"):
                self.get_error_response(
                    self.organization.slug, strategy="duplicate_monitors", status_code=429
                )
            limit.assert_called_once_with(
                f"seer-workflow:{self.organization.id}:duplicate_monitors", limit=5, window=3600
            )

    def test_requires_organization_access(self) -> None:
        other = self.create_organization()
        with self.feature("organizations:seer-workflows-monitor-cleanup"):
            self.get_error_response(other.slug, strategy="duplicate_monitors", status_code=403)

    def test_callback_for_deleted_user_marks_run_failed(self) -> None:
        agent_run = self.trigger()
        agent_run.run.update(user_id=999999999)
        deliver_monitor_cleanup_result(
            self.organization.id, agent_run.run.uuid, "completed", self.result(), None
        )
        agent_run.refresh_from_db()
        assert agent_run.extras["status"] == "failed"
        assert agent_run.extras["error"] == "The triggering user no longer exists."

    def trigger(self):
        with self.feature("organizations:seer-workflows-monitor-cleanup"):
            response = self.get_success_response(
                self.organization.slug, strategy="duplicate_monitors", status_code=202
            )
        return SeerAgentRun.objects.select_related("run").get(
            run__workflow_execution__run_id=response.data["runId"]
        )

    def result(self):
        return {
            "schema_version": 1,
            "data": {
                "scan_status": "complete",
                "projects": [
                    {
                        "project_id": str(self.project.id),
                        "scan_status": "complete",
                        "monitors_scanned": 2,
                        "summary": "Duplicate monitors found.",
                        "findings": [
                            {
                                "kind": "exact_duplicate",
                                "monitor_ids": [str(self.keep.id), str(self.duplicate.id)],
                                "suggested_keep_id": str(self.keep.id),
                                "reason": "Identical settings.",
                            }
                        ],
                    }
                ],
            },
        }


@override_settings(SENTRY_SELF_HOSTED=False)
@with_feature("organizations:seer-automations")
class OrganizationSeerWorkflowConfigsTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-workflow-configs"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def test_feature_disabled_does_not_seed_defaults(self) -> None:
        with self.feature({"organizations:seer-automations": False}):
            self.get_error_response(self.organization.slug, status_code=404)

        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()

    def test_empty_organization_does_not_seed_defaults(self) -> None:
        response = self.get_success_response(self.organization.slug)

        assert 'rel="next"' in response.headers["Link"]
        assert response.data == {"configs": []}
        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()

    def test_lists_saved_configs_for_organization(self) -> None:
        project = self.create_project()
        config = self.create_config(
            enabled=False,
            version=4,
            filters={"environments": ["production"], "min_event_count": 10},
            output_policy={"review_mode": "manual"},
            extras={"seeded_default": "agentic_triage_v2"},
        )
        Factories.create_seer_workflow_config_project(config, project)
        empty = self.create_config()
        Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE
        )
        Factories.create_seer_workflow_config(
            self.create_organization(owner=self.user),
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
        )

        response = self.get_success_response(self.organization.slug)

        assert [item["id"] for item in response.data["configs"]] == [str(config.id), str(empty.id)]
        assert response.data["configs"][0] == {
            "id": str(config.id),
            "strategy": "agentic_triage_v2",
            "enabled": False,
            "schedule": "daily",
            "version": 4,
            "projects": [project.id],
            "environments": ["production"],
            "filters": {"minEventCount": 10},
            "outputPolicy": {"review_mode": "manual"},
            "seededDefault": "agentic_triage_v2",
            "dateAdded": config.date_added,
            "dateUpdated": config.date_updated,
        }
        assert response.data["configs"][1]["projects"] == []

    def test_last_run_uses_each_configs_latest_invocation(self) -> None:
        config = self.create_config()
        other_config = self.create_config()
        empty_config = self.create_config()
        now = timezone.now()
        Factories.create_seer_workflow_run(
            self.organization, workflow_config=config, date_added=now - timedelta(days=2)
        )
        latest = Factories.create_seer_workflow_run(
            self.organization,
            workflow_config=config,
            date_added=now - timedelta(days=1),
            status=SeerWorkflowRunStatus.RUNNING,
        )
        other_run = Factories.create_seer_workflow_run(
            self.organization, workflow_config=other_config, date_added=now
        )
        Factories.create_seer_workflow_run(
            self.create_organization(), workflow_config=config, date_added=now
        )

        response = self.get_success_response(self.organization.slug)
        assert {item["id"]: item.get("lastRun") for item in response.data["configs"]} == {
            str(config.id): int(latest.date_added.timestamp()),
            str(other_config.id): int(other_run.date_added.timestamp()),
            str(empty_config.id): None,
        }
        assert "lastRun" not in response.data["configs"][2]

        details = self.client.get(
            reverse(
                "sentry-api-0-organization-seer-workflow-config-details",
                args=[self.organization.slug, config.id],
            )
        )
        assert details.status_code == 200
        assert details.data["lastRun"] == int(latest.date_added.timestamp())

    def test_last_run_only_includes_visible_history(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        team = self.create_team(organization=self.organization)
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[team])
        accessible = self.create_project(teams=[team])
        hidden = self.create_project(teams=[self.create_team(organization=self.organization)])
        config = self.create_config()
        hidden_config = self.create_config()
        visible_run = Factories.create_seer_workflow_run(
            self.organization,
            workflow_config=config,
            date_added=timezone.now() - timedelta(hours=1),
            extras={"snapshot": {"project_ids": [accessible.id]}},
        )
        for project_ids in ([hidden.id], [accessible.id, hidden.id]):
            Factories.create_seer_workflow_run(
                self.organization,
                workflow_config=config,
                extras={"snapshot": {"project_ids": project_ids}},
            )
        Factories.create_seer_workflow_run(self.organization, workflow_config=config)
        Factories.create_seer_workflow_run(
            self.organization,
            workflow_config=hidden_config,
            extras={"snapshot": {"project_ids": [hidden.id]}},
        )
        Factories.create_seer_workflow_config_project(config, hidden)
        self.login_as(member)

        response = self.get_success_response(self.organization.slug)
        assert response.data["configs"][0]["lastRun"] == int(visible_run.date_added.timestamp())
        assert "lastRun" not in response.data["configs"][1]
        details = self.client.get(
            reverse(
                "sentry-api-0-organization-seer-workflow-config-details",
                args=[self.organization.slug, config.id],
            )
        )
        assert details.status_code == 200
        assert details.data["lastRun"] == int(visible_run.date_added.timestamp())
        hidden_details = self.client.get(
            reverse(
                "sentry-api-0-organization-seer-workflow-config-details",
                args=[self.organization.slug, hidden_config.id],
            )
        )
        assert hidden_details.status_code == 200
        assert "lastRun" not in hidden_details.data

    def test_serialization_batches_database_reads(self) -> None:
        configs = [self.create_config() for _ in range(3)]
        runs = [
            Factories.create_seer_workflow_run(self.organization, workflow_config=config)
            for config in configs
        ]
        project_id = self.project.id
        using = router.db_for_read(SeerWorkflowConfig)
        with CaptureQueriesContext(connections[using]) as queries:
            result = serialize_workflow_configs(
                configs, accessible_project_ids=[project_id], has_global_access=True
            )

        assert len(queries) == 2
        assert [config["lastRun"] for config in result["configs"]] == [
            int(run.date_added.timestamp()) for run in runs
        ]

    def test_scope_only_includes_accessible_active_projects(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        team = self.create_team(organization=self.organization)
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[team])
        accessible = self.create_project(teams=[team])
        hidden = self.create_project(teams=[self.create_team(organization=self.organization)])
        inactive = self.create_project(teams=[team], status=ObjectStatus.PENDING_DELETION)
        foreign = self.create_project(organization=self.create_organization())
        selected = self.create_config()
        for project in (accessible, hidden, inactive, foreign):
            Factories.create_seer_workflow_config_project(selected, project)
        self.login_as(member)

        response = self.get_success_response(self.organization.slug)

        assert len(response.data["configs"]) == 1
        assert response.data["configs"][0]["projects"] == [accessible.id]

    def create_config(self, **kwargs) -> SeerWorkflowConfig:
        return Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2, **kwargs
        )


@override_settings(SENTRY_SELF_HOSTED=False)
@with_feature("organizations:seer-automations")
class OrganizationSeerWorkflowConfigDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-workflow-config-details"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def test_feature_disabled_returns_404(self) -> None:
        config = self.create_config()
        with self.feature({"organizations:seer-automations": False}):
            self.get_error_response(self.organization.slug, config.id, status_code=404)

    def test_returns_config(self) -> None:
        project = self.create_project()
        config = self.create_config(
            enabled=False,
            version=4,
            filters={"environments": ["production"], "min_event_count": 10},
            output_policy={"review_mode": "manual"},
            extras={"seeded_default": "agentic_triage_v2"},
        )
        Factories.create_seer_workflow_config_project(config, project)

        response = self.get_success_response(self.organization.slug, config.id)

        assert response.data == {
            "id": str(config.id),
            "strategy": "agentic_triage_v2",
            "enabled": False,
            "schedule": "daily",
            "version": 4,
            "projects": [project.id],
            "environments": ["production"],
            "filters": {"minEventCount": 10},
            "outputPolicy": {"review_mode": "manual"},
            "seededDefault": "agentic_triage_v2",
            "dateAdded": config.date_added,
            "dateUpdated": config.date_updated,
        }

    def test_missing_config_returns_404(self) -> None:
        self.get_error_response(self.organization.slug, 999999, status_code=404)

    def test_other_organization_config_returns_404(self) -> None:
        config = Factories.create_seer_workflow_config(
            self.create_organization(owner=self.user),
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
        )
        self.get_error_response(self.organization.slug, config.id, status_code=404)

    def test_non_configurable_strategy_returns_404(self) -> None:
        config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE
        )
        self.get_error_response(self.organization.slug, config.id, status_code=404)

    def create_config(self, **kwargs) -> SeerWorkflowConfig:
        return Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2, **kwargs
        )
