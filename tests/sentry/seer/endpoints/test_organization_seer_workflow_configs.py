from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, patch

from django.db import connections, router
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.response import Response

from sentry import audit_log
from sentry.auth.access import from_request
from sentry.constants import ObjectStatus
from sentry.db.models.fields.bounded import I64_MAX
from sentry.deletions.models.scheduleddeletion import CellScheduledDeletion
from sentry.incidents.grouptype import MetricIssue
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.project import Project
from sentry.seer.endpoints.organization_seer_workflow_configs import (
    OrganizationSeerWorkflowConfigDetailsEndpoint,
    _with_no_access_monitor_ids,
    _with_no_access_project_ids,
    serialize_workflow_configs,
)
from sentry.seer.models.workflow import (
    MAX_WORKFLOW_CONFIGS_PER_ORG,
    SeerWorkflowConfig,
    SeerWorkflowConfigProject,
    SeerWorkflowRun,
    SeerWorkflowRunStatus,
    SeerWorkflowStrategy,
)
from sentry.seer.workflows.base import (
    ConfigUpdate,
    SeerServiceAccountGrant,
    SelectedMonitors,
    WorkflowUpdateError,
)
from sentry.seer.workflows.breached_metrics import ConnectedMonitor
from sentry.seer.workflows.workflow import SeerWorkflow
from sentry.service_accounts.models import ServiceAccount, ServiceAccountProject
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.requests import drf_request_from_request
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.user import User
from sentry.utils import json
from sentry.workflow_engine.models import Detector, Workflow

GRANT = SeerServiceAccountGrant(scopes=["event:read"])


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
            "monitorIds": [],
            "serviceAccount": None,
            "environments": ["production"],
            "filters": {"minEventCount": 10},
            "outputPolicy": {"review_mode": "manual"},
            "seededDefault": "agentic_triage_v2",
            "nextRunAt": None,
            "dateAdded": config.date_added,
            "dateUpdated": config.date_updated,
        }
        assert response.data["configs"][1]["projects"] == []

    @freeze_time("2024-03-09 12:00:00")
    def test_includes_next_run_of_scheduled_configs(self) -> None:
        scheduled = self.create_config()
        with SeerWorkflow(
            config_id=scheduled.id, organization_id=scheduled.organization_id
        ).update_config() as update:
            update.set_enabled(True)
        unscheduled = self.create_config()

        response = self.get_success_response(self.organization.slug)

        next_runs = {item["id"]: item["nextRunAt"] for item in response.data["configs"]}
        assert next_runs[str(unscheduled.id)] is None
        # Spread over the hour after the scheduled 10:00 run.
        scheduled_for = datetime(2024, 3, 10, 10, 0, tzinfo=UTC)
        assert scheduled_for <= next_runs[str(scheduled.id)] < scheduled_for + timedelta(hours=1)

    def test_id_filter_is_scoped_and_applies_before_pagination(self) -> None:
        self.create_config()
        first = self.create_config()
        second = self.create_config()
        foreign = Factories.create_seer_workflow_config(
            self.create_organization(owner=self.user),
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
        )
        legacy = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE
        )
        response = self.get_success_response(
            self.organization.slug,
            id=[second.id, first.id, first.id, foreign.id, legacy.id, I64_MAX],
            per_page=1,
        )
        assert [config["id"] for config in response.data["configs"]] == [str(first.id)]
        next_url = next(
            url
            for url, link in parse_link_header(response.headers["Link"]).items()
            if link["rel"] == "next"
        )
        next_page = self.client.get(next_url)
        assert next_page.status_code == 200
        assert [config["id"] for config in next_page.data["configs"]] == [str(second.id)]
        assert (
            next(
                link
                for link in parse_link_header(next_page.headers["Link"]).values()
                if link["rel"] == "next"
            )["results"]
            == "false"
        )

        unavailable = self.get_success_response(
            self.organization.slug, id=[foreign.id, legacy.id, I64_MAX]
        )
        assert unavailable.data == {"configs": []}

    def test_invalid_config_ids(self) -> None:
        config = self.create_config()
        for invalid_id in ("invalid", "-1", str(I64_MAX + 1)):
            response = self.get_error_response(
                self.organization.slug, id=[config.id, invalid_id], status_code=400
            )
            assert "id" in response.data["detail"]

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
        assert {item["id"]: item.get("dateLastRun") for item in response.data["configs"]} == {
            str(config.id): latest.date_added,
            str(other_config.id): other_run.date_added,
            str(empty_config.id): None,
        }
        assert "dateLastRun" not in response.data["configs"][2]
        assert response.data["configs"][0]["lastRunStatus"] == "running"
        assert response.data["configs"][1]["lastRunStatus"] is None
        assert "lastRunStatus" not in response.data["configs"][2]

        assert (
            datetime.fromisoformat(json.loads(response.content)["configs"][0]["dateLastRun"])
            == latest.date_added
        )
        filtered = self.get_success_response(self.organization.slug, id=config.id)
        assert filtered.data["configs"] == [response.data["configs"][0]]

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
        assert response.data["configs"][0]["dateLastRun"] == visible_run.date_added
        assert response.data["configs"][0]["lastRunStatus"] == visible_run.status
        assert "dateLastRun" not in response.data["configs"][1]
        assert "lastRunStatus" not in response.data["configs"][1]

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

        assert len(queries) == 3
        assert [config["dateLastRun"] for config in result["configs"]] == [
            run.date_added for run in runs
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

    def test_breached_metric_lists_connected_monitors_and_their_projects(self) -> None:
        first_project, second_project = self.create_project(), self.create_project()
        monitors = [
            self.create_detector(project=first_project, type=MetricIssue.slug),
            self.create_detector(project=first_project, type=MetricIssue.slug),
            self.create_detector(project=second_project, type=MetricIssue.slug),
        ]
        disabled = self.create_detector(project=self.create_project(), type=MetricIssue.slug)
        metric = SeerWorkflow.create(
            organization_id=self.organization.id,
            strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
            scope=SelectedMonitors((*(m.id for m in monitors), disabled.id)),
            service_account_grant=GRANT,
        )
        disabled.update(status=ObjectStatus.DISABLED)
        triage = self.create_config()

        response = self.get_success_response(self.organization.slug)

        configs = {item["id"]: item for item in response.data["configs"]}
        assert configs[str(metric.config_id)]["monitorIds"] == sorted(m.id for m in monitors)
        assert configs[str(metric.config_id)]["projects"] == sorted(
            [first_project.id, second_project.id]
        )
        assert configs[str(triage.id)]["monitorIds"] == []

    def test_breached_metric_hides_monitors_in_inaccessible_projects(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        team = self.create_team(organization=self.organization)
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[team])
        accessible = self.create_detector(
            project=self.create_project(teams=[team]), type=MetricIssue.slug
        )
        hidden = self.create_detector(
            project=self.create_project(teams=[self.create_team(organization=self.organization)]),
            type=MetricIssue.slug,
        )
        SeerWorkflow.create(
            organization_id=self.organization.id,
            strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
            scope=SelectedMonitors((accessible.id, hidden.id)),
            service_account_grant=GRANT,
        )
        self.login_as(member)

        response = self.get_success_response(self.organization.slug)

        assert len(response.data["configs"]) == 1
        assert response.data["configs"][0]["monitorIds"] == [accessible.id]
        assert response.data["configs"][0]["projects"] == [accessible.project_id]

    def create_config(self, **kwargs: Any) -> SeerWorkflowConfig:
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
            self.get_error_response(
                self.organization.slug,
                config.id,
                method="put",
                projectIds=[self.project.id],
                status_code=404,
            )

    def test_get_matches_list_item(self) -> None:
        config = self.create_config()
        Factories.create_seer_workflow_config_project(config, self.project)

        response = self.get_success_response(self.organization.slug, config.id)

        listed = self.client.get(
            f"/api/0/organizations/{self.organization.slug}/seer/workflows/configs/",
            {"id": config.id},
        )
        assert response.data == listed.data["configs"][0]
        assert response.data["projects"] == [self.project.id]

    def test_get_includes_created_by(self) -> None:
        config = self.create_config(extras={"created_by": self.user.id})

        response = self.get_success_response(self.organization.slug, config.id)

        assert response.data["createdBy"] == str(self.user.id)

    @freeze_time("2024-03-09 12:00:00")
    def test_returns_next_run_of_scheduled_config(self) -> None:
        config = self.create_config()
        with SeerWorkflow(
            config_id=config.id, organization_id=config.organization_id
        ).update_config() as update:
            update.set_enabled(True)

        response = self.get_success_response(self.organization.slug, config.id)

        # Spread over the hour after the scheduled 10:00 run.
        scheduled_for = datetime(2024, 3, 10, 10, 0, tzinfo=UTC)
        assert scheduled_for <= response.data["nextRunAt"] < scheduled_for + timedelta(hours=1)

    def test_unavailable_config_returns_404(self) -> None:
        legacy = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE
        )
        foreign = Factories.create_seer_workflow_config(
            self.create_organization(owner=self.user),
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
        )
        for config_id in (legacy.id, foreign.id, I64_MAX):
            self.get_error_response(self.organization.slug, config_id, status_code=404)
            self.get_error_response(
                self.organization.slug,
                config_id,
                method="put",
                projectIds=[self.project.id],
                status_code=404,
            )

    def test_invalid_id_returns_400(self) -> None:
        self.get_error_response(self.organization.slug, "invalid", status_code=400)
        self.get_error_response(
            self.organization.slug,
            "invalid",
            method="put",
            projectIds=[self.project.id],
            status_code=400,
        )

    def test_put_replaces_projects(self) -> None:
        kept = self.create_project()
        removed = self.create_project()
        added = self.create_project()
        config = self.create_config(version=3)
        for project in (kept, removed):
            Factories.create_seer_workflow_config_project(config, project)

        response = self.get_success_response(
            self.organization.slug,
            config.id,
            method="put",
            projectIds=[kept.id, added.id, added.id],
        )

        assert sorted(response.data["projects"]) == sorted([kept.id, added.id])
        assert response.data["version"] == 4
        assert self.selected_project_ids(config) == sorted([kept.id, added.id])

    def test_put_empty_list_clears_projects(self) -> None:
        config = self.create_config()
        Factories.create_seer_workflow_config_project(config, self.project)

        response = self.get_success_response(
            self.organization.slug, config.id, method="put", projectIds=[]
        )

        assert response.data["projects"] == []
        assert self.selected_project_ids(config) == []

    def test_put_sets_updated_by(self) -> None:
        config = self.create_config(extras={"created_by": self.user.id})
        updater = self.create_user()
        self.create_member(organization=self.organization, user=updater, role="owner")
        self.login_as(updater)
        version = config.version

        response = self.get_success_response(
            self.organization.slug, config.id, method="put", enabled=True
        )

        assert response.data["createdBy"] == str(self.user.id)
        assert response.data["updatedBy"] == str(updater.id)
        # Recording the updater is part of the same save, so the version bumps once.
        assert response.data["version"] == version + 1
        config.refresh_from_db()
        assert config.extras == {"created_by": self.user.id, "updated_by": updater.id}

    def test_put_by_another_user_replaces_updated_by(self) -> None:
        config = self.create_config()
        self.get_success_response(self.organization.slug, config.id, method="put", enabled=True)
        other = self.create_user()
        self.create_member(organization=self.organization, user=other, role="owner")
        self.login_as(other)

        response = self.get_success_response(
            self.organization.slug, config.id, method="put", enabled=False
        )

        assert response.data["updatedBy"] == str(other.id)
        config.refresh_from_db()
        assert config.extras == {"updated_by": other.id}

    @patch(
        "sentry.seer.endpoints.organization_seer_workflow_configs.acting_user_id",
        return_value=None,
    )
    def test_put_by_non_user_sets_updated_by_bot(self, _: MagicMock) -> None:
        config = self.create_config()

        response = self.get_success_response(
            self.organization.slug, config.id, method="put", enabled=True
        )

        assert response.data["updatedBy"] == "bot"
        config.refresh_from_db()
        assert config.extras == {"updated_by": "bot"}

    def test_put_without_changes_keeps_version(self) -> None:
        config = self.create_config(version=3)
        Factories.create_seer_workflow_config_project(config, self.project)

        response = self.get_success_response(
            self.organization.slug, config.id, method="put", projectIds=[self.project.id]
        )
        assert response.data["version"] == 3
        assert self.selected_project_ids(config) == [self.project.id]
        assert "updatedBy" not in response.data

    def test_put_nonexistent_projects_return_403(self) -> None:
        config = self.create_config()
        Factories.create_seer_workflow_config_project(config, self.project)
        foreign = self.create_project(organization=self.create_organization())
        for project_id in (self.nonexistent_project_id(), foreign.id):
            self.get_error_response(
                self.organization.slug,
                config.id,
                method="put",
                projectIds=[self.project.id, project_id],
                status_code=403,
            )
        assert self.selected_project_ids(config) == [self.project.id]

    def test_put_unavailable_projects_return_403(self) -> None:
        config = self.create_config()
        Factories.create_seer_workflow_config_project(config, self.project)
        inactive = self.create_project(status=ObjectStatus.PENDING_DELETION)
        foreign = self.create_project(organization=self.create_organization())
        for project in (inactive, foreign):
            self.get_error_response(
                self.organization.slug,
                config.id,
                method="put",
                projectIds=[project.id],
                status_code=403,
            )
        assert self.selected_project_ids(config) == [self.project.id]

    def test_member_cannot_narrow_or_enable_all_projects_config(self) -> None:
        member, accessible = self.create_member_with_project(open_membership=False)
        config = self.create_config(filters={"all_projects": True})
        self.login_as(member)

        response = self.get_error_response(
            self.organization.slug,
            config.id,
            method="put",
            projectIds=[accessible.id],
            status_code=403,
        )

        assert response.data["detail"] == (
            "You do not have permission to narrow this config's project scope"
        )

        response = self.get_error_response(
            self.organization.slug, config.id, method="put", enabled=True, status_code=403
        )

        assert response.data["detail"] == "Requesting all projects requires global access"
        config.refresh_from_db()
        assert config.filters["all_projects"] is True
        assert config.enabled is False
        assert self.selected_project_ids(config) == []

    def test_member_cannot_put_all_projects(self) -> None:
        member, accessible = self.create_member_with_project(open_membership=False)
        config = self.create_config()
        Factories.create_seer_workflow_config_project(config, accessible)
        self.login_as(member)

        response = self.get_error_response(
            self.organization.slug, config.id, method="put", projectIds=[-1], status_code=403
        )

        assert response.data["detail"] == "Requesting all projects requires global access"

        config.refresh_from_db()
        assert config.filters.get("all_projects", False) is False
        assert self.selected_project_ids(config) == [accessible.id]

    def test_global_access_can_narrow_all_projects_config(self) -> None:
        config = self.create_config(filters={"all_projects": True})

        response = self.get_success_response(
            self.organization.slug, config.id, method="put", projectIds=[self.project.id]
        )

        assert response.data["projects"] == [self.project.id]
        config.refresh_from_db()
        assert config.filters["all_projects"] is False
        assert self.selected_project_ids(config) == [self.project.id]

    def test_global_access_can_put_all_projects(self) -> None:
        config = self.create_config(version=3)
        Factories.create_seer_workflow_config_project(config, self.project)

        response = self.get_success_response(
            self.organization.slug, config.id, method="put", projectIds=[-1]
        )

        assert response.data["projects"] == [-1]
        assert response.data["version"] == 4
        config.refresh_from_db()
        assert config.filters["all_projects"] is True
        assert self.selected_project_ids(config) == []

    def test_open_membership_member_can_put_all_projects(self) -> None:
        member, accessible = self.create_member_with_project(open_membership=True)
        config = self.create_config()
        Factories.create_seer_workflow_config_project(config, accessible)
        self.login_as(member)

        response = self.get_success_response(
            self.organization.slug, config.id, method="put", projectIds=[-1]
        )

        assert response.data["projects"] == [-1]
        config.refresh_from_db()
        assert config.filters["all_projects"] is True
        assert self.selected_project_ids(config) == []

    def test_member_put_keeps_inaccessible_projects(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        team = self.create_team(organization=self.organization)
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[team])
        accessible = self.create_project(teams=[team])
        other_accessible = self.create_project(teams=[team])
        hidden = self.create_project(teams=[self.create_team(organization=self.organization)])
        config = self.create_config()
        for project in (accessible, hidden):
            Factories.create_seer_workflow_config_project(config, project)
        self.login_as(member)

        self.get_error_response(
            self.organization.slug,
            config.id,
            method="put",
            projectIds=[hidden.id],
            status_code=403,
        )

        response = self.get_success_response(
            self.organization.slug, config.id, method="put", projectIds=[other_accessible.id]
        )

        assert response.data["projects"] == [other_accessible.id]
        assert self.selected_project_ids(config) == sorted([other_accessible.id, hidden.id])

    def test_put_breached_metric_member_keeps_inaccessible_monitors(self) -> None:
        member, accessible_project = self.create_member_with_project(open_membership=False)
        accessible = self.create_metric_monitor(accessible_project)
        other_accessible = self.create_metric_monitor(accessible_project)
        hidden = self.create_metric_monitor(
            self.create_project(teams=[self.create_team(organization=self.organization)])
        )
        workflow = self.create_metric_workflow(monitor_ids=[accessible.id, hidden.id])
        self.login_as(member)

        response = self.get_success_response(
            self.organization.slug,
            workflow.config_id,
            method="put",
            monitorIds=[other_accessible.id],
        )

        assert response.data["monitorIds"] == [other_accessible.id]
        assert response.data["projects"] == [accessible_project.id]
        assert self.connected_monitor_ids(workflow) == {other_accessible.id, hidden.id}

    def test_put_enables_and_pauses_metric_investigations(self) -> None:
        monitor = self.create_metric_monitor(self.project)
        workflow = self.create_metric_workflow(monitor_ids=[monitor.id])
        backing_workflow = Workflow.objects.filter(id=workflow.get_config().backing_workflow_id)
        assert not backing_workflow.get().enabled

        response = self.get_success_response(
            self.organization.slug, workflow.config_id, method="put", enabled=True
        )
        assert response.data["enabled"] is True
        assert workflow.matches_scope(self.project.id, None)
        assert backing_workflow.get().enabled
        version = response.data["version"]

        repeated = self.get_success_response(
            self.organization.slug, workflow.config_id, method="put", enabled=True
        )
        assert repeated.data["version"] == version

        response = self.get_success_response(
            self.organization.slug, workflow.config_id, method="put", enabled=False
        )
        assert response.data["enabled"] is False
        assert not workflow.matches_scope(self.project.id, None)
        assert response.data["monitorIds"] == [monitor.id]
        assert not backing_workflow.get().enabled

    def test_member_cannot_enable_investigations_for_inaccessible_projects(self) -> None:
        monitor = self.create_metric_monitor(self.project)
        workflow = self.create_metric_workflow(monitor_ids=[monitor.id])
        member, _ = self.create_member_with_project(open_membership=False)
        self.login_as(member)

        self.get_error_response(
            self.organization.slug,
            workflow.config_id,
            method="put",
            enabled=True,
            status_code=403,
        )
        assert workflow.get_config().enabled is False

    def test_put_enables_all_projects_config(self) -> None:
        config = self.create_config(filters={"all_projects": True})
        self.get_error_response(self.organization.slug, config.id, method="put", status_code=400)

        response = self.get_success_response(
            self.organization.slug, config.id, method="put", enabled=True
        )
        assert response.data["enabled"] is True
        config.refresh_from_db()
        assert config.enabled is True

    def test_agent_projects_hide_projects_the_viewer_cannot_access(self) -> None:
        member, accessible = self.create_member_with_project(open_membership=False)
        hidden = self.create_project(teams=[self.create_team(organization=self.organization)])
        with outbox_runner():
            workflow = self.create_metric_workflow(
                service_account_grant=SeerServiceAccountGrant(
                    scopes=["event:read"], project_ids=[accessible.id, hidden.id]
                )
            )
        self.login_as(member)

        response = self.get_success_response(self.organization.slug, workflow.config_id)

        assert response.data["serviceAccount"]["projectIds"] == [accessible.id]
        assert service_account_project_ids(get_service_account(workflow.config_id)) == sorted(
            [accessible.id, hidden.id]
        )

    @with_feature("organizations:service-accounts")
    def test_member_put_service_account_keeps_hidden_projects_without_adding_scopes(self) -> None:
        member, accessible = self.create_member_with_project(open_membership=False)
        hidden = self.create_project(teams=[self.create_team(organization=self.organization)])
        deleted = self.create_project()
        with outbox_runner():
            workflow = self.create_metric_workflow(
                service_account_grant=SeerServiceAccountGrant(
                    scopes=["event:read", "project:read"],
                    project_ids=[accessible.id, hidden.id, deleted.id],
                )
            )
        Project.objects.filter(id=deleted.id).update(status=ObjectStatus.PENDING_DELETION)
        self.login_as(member)

        self.get_error_response(
            self.organization.slug,
            workflow.config_id,
            method="put",
            serviceAccount={
                "scopes": ["event:read", "event:write", "project:read"],
                "projectIds": [accessible.id],
            },
            status_code=403,
        )

        response = self.get_success_response(
            self.organization.slug,
            workflow.config_id,
            method="put",
            serviceAccount={"scopes": ["event:read"], "projectIds": [accessible.id]},
        )

        assert response.data["serviceAccount"]["projectIds"] == [accessible.id]
        account = get_service_account(workflow.config_id)
        assert account.scope_list == ["event:read"]
        assert service_account_project_ids(account) == sorted([accessible.id, hidden.id])

    @with_feature("organizations:service-accounts")
    def test_put_service_account_on_a_config_without_one_returns_400(self) -> None:
        config = self.create_config()

        with outbox_runner():
            response = self.get_error_response(
                self.organization.slug,
                config.id,
                method="put",
                serviceAccount={"scopes": ["event:read"], "projectIds": [self.project.id]},
                status_code=400,
            )

        assert response.data == {"detail": "Couldn't update the automation."}
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not ServiceAccount.objects.filter(organization_id=self.organization.id).exists()

    @with_feature("organizations:service-accounts")
    def test_put_updates_the_existing_service_account(self) -> None:
        with outbox_runner():
            workflow = self.create_metric_workflow()
        version = workflow.get_config().version
        grant = {"scopes": ["project:read"], "allProjects": True}

        with outbox_runner():
            response = self.get_success_response(
                self.organization.slug, workflow.config_id, method="put", serviceAccount=grant
            )

        account = get_service_account(workflow.config_id)
        assert account.scope_list == ["project:read"]
        assert account.all_projects
        assert response.data["updatedBy"] == str(self.user.id)
        assert response.data["serviceAccount"] == {
            "serviceAccountId": str(account.id),
            "scopes": ["project:read"],
            "projectIds": [],
            "allProjects": True,
        }

        with outbox_runner():
            self.get_success_response(
                self.organization.slug, workflow.config_id, method="put", serviceAccount=grant
            )

        assert workflow.get_config().version == version + 1
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert (
                AuditLogEntry.objects.filter(
                    event=audit_log.get_event_id("SERVICE_ACCOUNT_EDIT"), target_object=account.id
                ).count()
                == 1
            )

    @with_feature("organizations:service-accounts")
    def test_put_service_account_is_limited_to_the_callers_access(self) -> None:
        workflow = self.create_metric_workflow()
        token = self.create_user_auth_token(user=self.user, scope_list=["project:read"])

        response = self.client.put(
            f"/api/0/organizations/{self.organization.slug}/seer/workflows/configs/{workflow.config_id}/",
            {"serviceAccount": {"scopes": ["org:write"]}},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
        )

        assert response.status_code == 403
        assert get_service_account(workflow.config_id).scope_list == ["event:read"]

        self.get_success_response(
            self.organization.slug,
            workflow.config_id,
            method="put",
            serviceAccount={"scopes": ["event:read"], "allProjects": True},
        )
        member, project = self.create_member_with_project(open_membership=False)
        self.login_as(member)

        self.get_error_response(
            self.organization.slug,
            workflow.config_id,
            method="put",
            serviceAccount={"scopes": ["event:read"], "projectIds": [project.id]},
            status_code=403,
        )
        assert get_service_account(workflow.config_id).all_projects

        with self.feature({"organizations:service-accounts": False}):
            self.get_error_response(
                self.organization.slug,
                workflow.config_id,
                method="put",
                serviceAccount={"scopes": ["event:read"]},
                status_code=404,
            )

    def test_put_breached_metric_replaces_monitors(self) -> None:
        kept, removed, added = (self.create_metric_monitor(self.create_project()) for _ in range(3))
        workflow = self.create_metric_workflow(monitor_ids=[kept.id, removed.id])
        version = workflow.get_config().version

        response = self.get_success_response(
            self.organization.slug,
            workflow.config_id,
            method="put",
            monitorIds=[kept.id, added.id],
        )

        assert response.data["version"] == version + 1
        assert self.connected_monitor_ids(workflow) == {kept.id, added.id}
        assert response.data["monitorIds"] == sorted([kept.id, added.id])
        assert response.data["projects"] == sorted([kept.project_id, added.project_id])

    def test_put_monitor_ids_on_non_metric_config_returns_400(self) -> None:
        config = self.create_config()
        monitor = self.create_metric_monitor(self.project)

        response = self.get_error_response(
            self.organization.slug,
            config.id,
            method="put",
            monitorIds=[monitor.id],
            status_code=400,
        )

        assert response.data == {
            "detail": "This automation type does not support monitor selection."
        }
        config.refresh_from_db()
        assert config.version == 1
        assert config.backing_workflow_id is None

    def test_put_breached_metric_member_needs_access_to_monitor_projects(self) -> None:
        member, accessible_project = self.create_member_with_project(open_membership=False)
        accessible = self.create_metric_monitor(accessible_project)
        other_accessible = self.create_metric_monitor(accessible_project)
        hidden = self.create_metric_monitor(
            self.create_project(teams=[self.create_team(organization=self.organization)])
        )
        workflow = self.create_metric_workflow(monitor_ids=[accessible.id])
        self.login_as(member)

        self.get_error_response(
            self.organization.slug,
            workflow.config_id,
            method="put",
            monitorIds=[accessible.id, hidden.id],
            status_code=403,
        )
        assert self.connected_monitor_ids(workflow) == {accessible.id}

        self.get_success_response(
            self.organization.slug,
            workflow.config_id,
            method="put",
            monitorIds=[accessible.id, other_accessible.id],
        )
        assert self.connected_monitor_ids(workflow) == {accessible.id, other_accessible.id}

    def test_put_breached_metric_rejects_ineligible_monitors(self) -> None:
        connected = self.create_metric_monitor(self.project)
        workflow = self.create_metric_workflow(monitor_ids=[connected.id])
        ineligible = [
            self.create_detector(project=self.project),
            self.create_detector(
                project=self.project, type=MetricIssue.slug, status=ObjectStatus.DISABLED
            ),
            self.create_metric_monitor(
                self.create_project(organization=self.create_organization())
            ),
        ]
        for monitor in ineligible:
            response = self.get_error_response(
                self.organization.slug,
                workflow.config_id,
                method="put",
                monitorIds=[monitor.id],
                status_code=400,
            )
            assert response.data == {"detail": "Couldn't update the automation."}

        assert self.connected_monitor_ids(workflow) == {connected.id}

    def test_put_projects_and_enabled_bumps_version_once(self) -> None:
        config = self.create_config()
        response = self.get_success_response(
            self.organization.slug,
            config.id,
            method="put",
            projectIds=[self.project.id],
            enabled=True,
            name="Checkout triage",
        )

        assert response.data["version"] == config.version + 1
        assert response.data["enabled"] is True
        assert response.data["projects"] == [self.project.id]
        assert response.data["name"] == "Checkout triage"
        config.refresh_from_db()
        assert config.extras["name"] == "Checkout triage"

    def test_put_failure_rolls_back_every_change(self) -> None:
        config = self.create_config()
        Factories.create_seer_workflow_config_project(config, self.project)
        other = self.create_project()

        # Fail on the last change, after the project change has been applied.
        with patch.object(ConfigUpdate, "set_enabled", side_effect=WorkflowUpdateError("failed")):
            self.get_error_response(
                self.organization.slug,
                config.id,
                method="put",
                projectIds=[other.id],
                enabled=True,
                status_code=400,
            )

        config.refresh_from_db()
        assert config.version == 1
        assert config.enabled is False
        assert self.selected_project_ids(config) == [self.project.id]

    def test_put_project_ids_on_breached_metric_config_returns_400(self) -> None:
        workflow = self.create_metric_workflow()

        response = self.get_error_response(
            self.organization.slug,
            workflow.config_id,
            method="put",
            projectIds=[self.project.id],
            status_code=400,
        )

        assert response.data == {"detail": "Couldn't update the automation."}
        assert self.selected_project_ids(workflow.get_config()) == []

    def test_agent_projects_remain_independent_when_monitors_change(self) -> None:
        monitor = self.create_metric_monitor(self.project)
        additional_project = self.create_project()
        with outbox_runner():
            workflow = self.create_metric_workflow(
                monitor_ids=[monitor.id],
                service_account_grant=SeerServiceAccountGrant(
                    scopes=["event:read"], project_ids=[self.project.id, additional_project.id]
                ),
            )
        account = get_service_account(workflow.config_id)

        response = self.get_success_response(
            self.organization.slug, workflow.config_id, method="put", monitorIds=[]
        )

        assert response.data["serviceAccount"] == {
            "serviceAccountId": str(account.id),
            "scopes": ["event:read"],
            "projectIds": sorted([self.project.id, additional_project.id]),
            "allProjects": False,
        }
        assert response.data["projects"] == []

    def test_delete(self) -> None:
        with outbox_runner():
            account = Factories.create_service_account(self.organization)
        config = self.create_config(service_account_id=account.id)
        Factories.create_seer_workflow_config_project(config, self.project)
        run = Factories.create_seer_workflow_run(self.organization, workflow_config=config)

        with outbox_runner():
            self.get_success_response(
                self.organization.slug, config.id, method="delete", status_code=204
            )

        assert not SeerWorkflowConfig.objects.filter(id=config.id).exists()
        assert not SeerWorkflowConfigProject.objects.filter(config_id=config.id).exists()
        assert not SeerWorkflowRun.objects.filter(id=run.id).exists()
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not ServiceAccount.objects.get(id=account.id).is_active
            assert AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("SERVICE_ACCOUNT_REMOVE"), target_object=account.id
            ).exists()

    def test_open_membership_member_can_delete(self) -> None:
        member, _ = self.create_member_with_project(open_membership=True)
        config = self.create_config()
        self.login_as(user=member)

        self.get_success_response(
            self.organization.slug, config.id, method="delete", status_code=204
        )

        assert not SeerWorkflowConfig.objects.filter(id=config.id).exists()

    def test_closed_membership_member_cannot_delete(self) -> None:
        member, _ = self.create_member_with_project(open_membership=False)
        config = self.create_config()
        self.login_as(user=member)

        response = self.get_error_response(
            self.organization.slug, config.id, method="delete", status_code=403
        )

        assert response.data == {"detail": "Deleting an automation requires global access"}
        assert SeerWorkflowConfig.objects.filter(id=config.id).exists()

    def test_delete_breached_metric(self) -> None:
        monitor = self.create_metric_monitor(self.project)
        workflow = self.create_metric_workflow(monitor_ids=[monitor.id])
        with outbox_runner():
            account = Factories.create_service_account(self.organization)
        SeerWorkflowConfig.objects.filter(id=workflow.config_id).update(
            service_account_id=account.id
        )
        backing_workflow = workflow.get_config().backing_workflow
        assert backing_workflow is not None
        run = Factories.create_seer_workflow_run(
            self.organization, workflow_config=workflow.get_config()
        )

        self.get_success_response(
            self.organization.slug, workflow.config_id, method="delete", status_code=204
        )

        assert not SeerWorkflowConfig.objects.filter(id=workflow.config_id).exists()
        backing_workflow = Workflow.objects_for_deletion.get(id=backing_workflow.id)
        assert backing_workflow.status == ObjectStatus.PENDING_DELETION
        assert CellScheduledDeletion.objects.filter(
            model_name="Workflow", object_id=backing_workflow.id
        ).exists()
        assert not SeerWorkflowRun.objects.filter(id=run.id).exists()
        monitor.refresh_from_db()
        assert monitor.status == ObjectStatus.ACTIVE
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not ServiceAccount.objects.get(id=account.id).is_active

    def create_metric_monitor(self, project: Project) -> Detector:
        return self.create_detector(project=project, type=MetricIssue.slug)

    def create_metric_workflow(
        self,
        monitor_ids: list[int] | None = None,
        service_account_grant: SeerServiceAccountGrant = GRANT,
    ) -> SeerWorkflow:
        return SeerWorkflow.create(
            organization_id=self.organization.id,
            strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
            scope=SelectedMonitors(tuple(monitor_ids or ())),
            service_account_grant=service_account_grant,
        )

    def connected_monitor_ids(self, workflow: SeerWorkflow) -> set[int]:
        backing_workflow = workflow.get_config().backing_workflow
        assert backing_workflow is not None
        return set(backing_workflow.detectorworkflow_set.values_list("detector_id", flat=True))

    def create_member_with_project(self, *, open_membership: bool) -> tuple[User, Project]:
        """Create a member of one team and return them with that team's project."""
        self.organization.flags.allow_joinleave = open_membership
        self.organization.save()
        team = self.create_team(organization=self.organization)
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[team])
        return member, self.create_project(teams=[team])

    def nonexistent_project_id(self) -> int:
        return Project.objects.order_by("-id").values_list("id", flat=True)[0] + 1000

    def selected_project_ids(self, config: SeerWorkflowConfig) -> list[int]:
        return sorted(
            SeerWorkflowConfigProject.objects.filter(config=config).values_list(
                "project_id", flat=True
            )
        )

    def create_config(self, **kwargs: Any) -> SeerWorkflowConfig:
        return Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2, **kwargs
        )


@override_settings(SENTRY_SELF_HOSTED=False)
@with_feature("organizations:seer-automations")
@with_feature("organizations:service-accounts")
class OrganizationSeerWorkflowConfigCreateTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-workflow-configs"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def get_response(self, *args: Any, **params: Any) -> Response:
        params.setdefault("serviceAccount", {"scopes": ["event:read"]})
        return super().get_response(*args, **params)

    def test_feature_disabled_returns_404(self) -> None:
        with self.feature({"organizations:seer-automations": False}):
            self.get_error_response(
                self.organization.slug, strategy="agentic_triage_v2", status_code=404
            )
        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()

    def test_creates_config_with_defaults(self) -> None:
        response = self.get_success_response(
            self.organization.slug, strategy="agentic_triage_v2", status_code=201
        )

        config = SeerWorkflowConfig.objects.get(organization=self.organization)
        assert response.data == {
            "id": str(config.id),
            "strategy": "agentic_triage_v2",
            "enabled": False,
            "schedule": "daily",
            "version": 1,
            "projects": [],
            "monitorIds": [],
            "serviceAccount": {
                "serviceAccountId": str(config.service_account_id),
                "scopes": ["event:read"],
                "projectIds": [],
                "allProjects": False,
            },
            "environments": [],
            "filters": {},
            "outputPolicy": {},
            "seededDefault": None,
            "nextRunAt": None,
            "dateAdded": config.date_added,
            "dateUpdated": config.date_updated,
            "createdBy": str(self.user.id),
        }
        assert config.extras == {"created_by": self.user.id}

    @patch(
        "sentry.seer.endpoints.organization_seer_workflow_configs.acting_user_id",
        return_value=None,
    )
    def test_create_by_non_user_omits_created_by(self, _: MagicMock) -> None:
        response = self.get_success_response(
            self.organization.slug, strategy="agentic_triage_v2", status_code=201
        )

        assert "createdBy" not in response.data
        assert SeerWorkflowConfig.objects.get(id=response.data["id"]).extras == {}

    @with_feature("organizations:service-accounts")
    def test_creates_metric_automation_with_broader_agent_access(self) -> None:
        monitor = self.create_metric_monitor(self.project)
        additional_project = self.create_project()
        agent = {
            "scopes": ["event:read", "org:read", "project:read"],
            "projectIds": [self.project.id, additional_project.id],
            "allProjects": False,
        }

        response = self.get_success_response(
            self.organization.slug,
            strategy="breached_metric_investigation",
            name="Checkout errors",
            monitorIds=[monitor.id],
            serviceAccount=agent,
            status_code=201,
        )

        account = get_service_account(int(response.data["id"]))
        assert account.name.startswith("Seer: Checkout errors ")
        assert service_account_project_ids(account) == [self.project.id, additional_project.id]
        assert SeerWorkflowConfig.objects.get(id=response.data["id"]).version == 1
        assert response.data["serviceAccount"] == {"serviceAccountId": str(account.id), **agent}
        assert response.data["projects"] == [self.project.id]
        assert response.data["monitorIds"] == [monitor.id]

    @with_feature("organizations:service-accounts")
    def test_creates_scheduled_automation_with_agent(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            strategy="agentic_triage_v2",
            projectIds=[self.project.id],
            serviceAccount={"scopes": ["event:read"], "allProjects": True},
            status_code=201,
        )

        account = get_service_account(int(response.data["id"]))
        assert account.name.startswith("Seer automation ")
        assert account.all_projects
        assert response.data["serviceAccount"] == {
            "serviceAccountId": str(account.id),
            "scopes": ["event:read"],
            "projectIds": [],
            "allProjects": True,
        }

    @with_feature("organizations:service-accounts")
    def test_failed_create_removes_the_service_account(self) -> None:
        for _ in range(MAX_WORKFLOW_CONFIGS_PER_ORG):
            Factories.create_seer_workflow_config(
                self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
            )

        with outbox_runner():
            self.get_error_response(
                self.organization.slug,
                strategy="agentic_triage_v2",
                serviceAccount={"scopes": ["event:read"]},
                status_code=400,
            )

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not ServiceAccount.objects.filter(is_active=True).exists()
            assert not AuditLogEntry.objects.filter(organization_id=self.organization.id).exists()

    def test_agent_ignores_duplicate_scopes_and_projects(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            strategy="agentic_triage_v2",
            serviceAccount={
                "scopes": ["project:read", "event:read", "event:read"],
                "projectIds": [self.project.id, self.project.id],
            },
            status_code=201,
        )

        account = get_service_account(int(response.data["id"]))
        assert account.scope_list == ["event:read", "project:read"]
        assert service_account_project_ids(account) == [self.project.id]
        assert response.data["serviceAccount"]["scopes"] == ["event:read", "project:read"]
        assert response.data["serviceAccount"]["projectIds"] == [self.project.id]

    def test_agent_grants_are_limited_to_the_callers_access(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/seer/workflows/configs/"
        token = self.create_user_auth_token(user=self.user, scope_list=["org:write"])
        api_key = self.create_api_key(
            organization=self.organization, scope_list=["org:write", "event:read"]
        )

        lacks_scope = self.client.post(
            url,
            {"strategy": "agentic_triage_v2", "serviceAccount": {"scopes": ["org:admin"]}},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
        )
        all_projects_without_role = self.client.post(
            url,
            {
                "strategy": "agentic_triage_v2",
                "serviceAccount": {"scopes": ["event:read"], "allProjects": True},
            },
            format="json",
            HTTP_AUTHORIZATION=self.create_basic_auth_header(api_key.key),
        )

        assert lacks_scope.status_code == 403
        assert (
            lacks_scope.data["detail"] == "You can't give a service account scopes you don't have."
        )
        assert all_projects_without_role.status_code == 403
        assert all_projects_without_role.data["detail"] == (
            "Only a role with access to all projects can give a service account all projects."
        )
        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not ServiceAccount.objects.exists()

    def test_requires_service_accounts_feature(self) -> None:
        with self.feature({"organizations:service-accounts": False}):
            self.get_error_response(
                self.organization.slug, strategy="agentic_triage_v2", status_code=404
            )
        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()

    def test_creates_config_with_fields(self) -> None:
        other = self.create_project()

        response = self.get_success_response(
            self.organization.slug,
            strategy="agentic_triage_v2",
            enabled=True,
            environments=["production"],
            projectIds=[self.project.id, other.id, other.id],
            name="Checkout triage",
            status_code=201,
        )

        config = SeerWorkflowConfig.objects.get(id=response.data["id"])
        assert config.enabled is True
        assert config.extras == {"name": "Checkout triage", "created_by": self.user.id}
        assert response.data["name"] == "Checkout triage"
        assert response.data["environments"] == ["production"]
        assert sorted(response.data["projects"]) == sorted([self.project.id, other.id])
        assert self.selected_project_ids(config) == sorted([self.project.id, other.id])

    def test_all_projects(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            strategy="agentic_triage_v2",
            projectIds=[-1],
            status_code=201,
        )

        config = SeerWorkflowConfig.objects.get(id=response.data["id"])
        assert response.data["projects"] == [-1]
        assert config.filters["all_projects"] is True
        assert self.selected_project_ids(config) == []

    def test_nonexistent_projects_return_403(self) -> None:
        foreign = self.create_project(organization=self.create_organization())
        for project_id in (self.nonexistent_project_id(), foreign.id):
            self.get_error_response(
                self.organization.slug,
                strategy="agentic_triage_v2",
                projectIds=[self.project.id, project_id],
                status_code=403,
            )
        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()

    def test_unavailable_projects_return_403(self) -> None:
        inactive = self.create_project(status=ObjectStatus.PENDING_DELETION)
        foreign = self.create_project(organization=self.create_organization())
        for project in (inactive, foreign):
            self.get_error_response(
                self.organization.slug,
                strategy="agentic_triage_v2",
                projectIds=[self.project.id, project.id],
                status_code=403,
            )
        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()

    def test_member_needs_access_to_requested_projects(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        team = self.create_team(organization=self.organization)
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[team])
        accessible = self.create_project(teams=[team])
        hidden = self.create_project(teams=[self.create_team(organization=self.organization)])
        self.login_as(member)

        self.get_error_response(
            self.organization.slug,
            strategy="agentic_triage_v2",
            projectIds=[accessible.id, hidden.id],
            status_code=403,
        )

        response = self.get_error_response(
            self.organization.slug,
            strategy="agentic_triage_v2",
            projectIds=[-1],
            status_code=403,
        )
        assert response.data["detail"] == "Requesting all projects requires global access"
        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()

        response = self.get_success_response(
            self.organization.slug,
            strategy="agentic_triage_v2",
            projectIds=[accessible.id],
            status_code=201,
        )
        assert response.data["projects"] == [accessible.id]

    def test_open_membership_member_can_create_all_projects_config(self) -> None:
        member, _ = self.create_member_with_project(open_membership=True)
        self.login_as(member)

        response = self.get_success_response(
            self.organization.slug,
            strategy="agentic_triage_v2",
            projectIds=[-1],
            status_code=201,
        )

        assert response.data["projects"] == [-1]
        config = SeerWorkflowConfig.objects.get(id=response.data["id"])
        assert config.filters["all_projects"] is True

    def test_caps_configs_per_organization(self) -> None:
        for _ in range(MAX_WORKFLOW_CONFIGS_PER_ORG):
            Factories.create_seer_workflow_config(
                self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
            )
        Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE
        )

        response = self.get_error_response(
            self.organization.slug, strategy="agentic_triage_v2", status_code=400
        )

        assert response.data["detail"] == "Couldn't create the automation."
        assert (
            SeerWorkflowConfig.objects.filter(
                organization=self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
            ).count()
            == MAX_WORKFLOW_CONFIGS_PER_ORG
        )

    def test_rejects_monitor_ids_for_non_metric_strategy(self) -> None:
        monitor = self.create_metric_monitor(self.project)

        response = self.get_error_response(
            self.organization.slug,
            strategy="agentic_triage_v2",
            monitorIds=[monitor.id],
            status_code=400,
        )

        assert response.data == {
            "monitorIds": ["This automation type does not support monitor selection."]
        }
        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()

    def test_breached_metric_creates_with_monitors(self) -> None:
        monitors = [self.create_metric_monitor(self.create_project()) for _ in range(2)]

        response = self.get_success_response(
            self.organization.slug,
            strategy="breached_metric_investigation",
            enabled=True,
            environments=["production"],
            monitorIds=[monitor.id for monitor in monitors],
            name="Latency breaches",
            status_code=201,
        )

        config = SeerWorkflowConfig.objects.get(id=response.data["id"])
        assert config.strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
        assert config.enabled is True
        assert config.filters == {"all_projects": False, "environments": ["production"]}
        assert config.extras == {"name": "Latency breaches", "created_by": self.user.id}
        assert config.version == 1
        assert config.backing_workflow is not None
        assert set(
            config.backing_workflow.detectorworkflow_set.values_list("detector_id", flat=True)
        ) == {monitor.id for monitor in monitors}
        assert response.data["monitorIds"] == sorted(monitor.id for monitor in monitors)
        assert response.data["projects"] == sorted(monitor.project_id for monitor in monitors)

    def test_breached_metric_creates_without_monitors(self) -> None:
        response = self.get_success_response(
            self.organization.slug, strategy="breached_metric_investigation", status_code=201
        )

        config = SeerWorkflowConfig.objects.get(id=response.data["id"])
        assert config.strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
        assert config.backing_workflow is not None
        assert not config.backing_workflow.detectorworkflow_set.exists()
        assert response.data["monitorIds"] == []
        assert response.data["projects"] == []

    def test_breached_metric_rejects_project_ids_and_schedule(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            strategy="breached_metric_investigation",
            projectIds=[self.project.id],
            status_code=400,
        )
        assert response.data == {
            "projectIds": ["Metric automation projects are selected by connecting monitors."]
        }

        response = self.get_error_response(
            self.organization.slug,
            strategy="breached_metric_investigation",
            schedule="daily",
            status_code=400,
        )
        assert response.data == {
            "schedule": ["Metric automations run when a monitor breaches, not on a schedule."]
        }

        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()

    def test_breached_metric_member_needs_access_to_monitor_projects(self) -> None:
        member, accessible_project = self.create_member_with_project(open_membership=False)
        accessible = self.create_metric_monitor(accessible_project)
        hidden = self.create_metric_monitor(
            self.create_project(teams=[self.create_team(organization=self.organization)])
        )
        self.login_as(member)

        self.get_error_response(
            self.organization.slug,
            strategy="breached_metric_investigation",
            monitorIds=[accessible.id, hidden.id],
            status_code=403,
        )
        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()

        self.get_success_response(
            self.organization.slug,
            strategy="breached_metric_investigation",
            monitorIds=[accessible.id],
            status_code=201,
        )

    def test_breached_metric_rejects_ineligible_monitors(self) -> None:
        ineligible = [
            self.create_detector(project=self.project),
            self.create_detector(
                project=self.project, type=MetricIssue.slug, status=ObjectStatus.DISABLED
            ),
            self.create_metric_monitor(
                self.create_project(organization=self.create_organization())
            ),
        ]
        for monitor in ineligible:
            response = self.get_error_response(
                self.organization.slug,
                strategy="breached_metric_investigation",
                monitorIds=[monitor.id],
                status_code=400,
            )
            assert response.data == {"detail": "Couldn't create the automation."}

        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()

    def test_rate_limits_creation(self) -> None:
        for _ in range(5):
            self.get_success_response(
                self.organization.slug, strategy="agentic_triage_v2", status_code=201
            )
        self.get_error_response(
            self.organization.slug, strategy="agentic_triage_v2", status_code=429
        )

    def create_metric_monitor(self, project: Project) -> Detector:
        return self.create_detector(project=project, type=MetricIssue.slug)

    def create_member_with_project(self, *, open_membership: bool) -> tuple[User, Project]:
        """Create a member of one team and return them with that team's project."""
        self.organization.flags.allow_joinleave = open_membership
        self.organization.save()
        team = self.create_team(organization=self.organization)
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[team])
        return member, self.create_project(teams=[team])

    def nonexistent_project_id(self) -> int:
        return Project.objects.order_by("-id").values_list("id", flat=True)[0] + 1000

    def selected_project_ids(self, config: SeerWorkflowConfig) -> list[int]:
        return sorted(
            SeerWorkflowConfigProject.objects.filter(config=config).values_list(
                "project_id", flat=True
            )
        )


class WithNoAccessIdsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        team = self.create_team(organization=self.organization)
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[team])
        other_team = self.create_team(organization=self.organization)

        self.readable = [self.create_project(teams=[team]) for _ in range(2)]
        self.no_access = [self.create_project(teams=[other_team]) for _ in range(2)]

        self.request = drf_request_from_request(self.make_request(user=member))
        self.request.access = from_request(self.request, self.organization)

    def test_keeps_requested_and_only_adds_current_projects_without_access(self) -> None:
        readable_ids = [project.id for project in self.readable]
        no_access_ids = [project.id for project in self.no_access]
        requested = [readable_ids[0]]

        for curr in [
            [],
            readable_ids,
            no_access_ids[:1],
            no_access_ids,
            [*readable_ids, *no_access_ids],
        ]:
            result = _with_no_access_project_ids(
                requested,
                curr,
                request=self.request,
                organization=self.organization,
                endpoint=OrganizationSeerWorkflowConfigDetailsEndpoint(),
            )

            # Every requested project is kept.
            assert set(requested) <= set(result)
            # Everything else is a project the caller can't read.
            assert set(result) - set(requested) <= set(no_access_ids)
            # No current project without access is dropped.
            assert set(curr) & set(no_access_ids) <= set(result)

    def test_keeps_requested_and_only_adds_current_monitors_without_access(self) -> None:
        readable_monitors = [
            self.create_detector(project=project, type=MetricIssue.slug)
            for project in self.readable
        ]
        no_access_monitors = [
            self.create_detector(project=project, type=MetricIssue.slug)
            for project in self.no_access
        ]
        readable_pairs = [ConnectedMonitor(m.id, m.project_id) for m in readable_monitors]
        no_access_pairs = [ConnectedMonitor(m.id, m.project_id) for m in no_access_monitors]
        no_access_ids = {m.id for m in no_access_monitors}
        requested = [readable_monitors[0].id]
        curr_cases = [
            [],
            readable_pairs,
            no_access_pairs[:1],
            no_access_pairs,
            [*readable_pairs, *no_access_pairs],
        ]

        for curr in curr_cases:
            result = _with_no_access_monitor_ids(
                requested,
                curr,
                request=self.request,
                organization=self.organization,
                endpoint=OrganizationSeerWorkflowConfigDetailsEndpoint(),
            )

            # Every requested monitor is kept.
            assert set(requested) <= set(result)
            # Everything else is a monitor in a project the caller can't read.
            assert set(result) - set(requested) <= no_access_ids
            # No current monitor without access is dropped.
            assert {monitor_id for monitor_id, _ in curr} & no_access_ids <= set(result)


def get_service_account(config_id: int) -> ServiceAccount:
    service_account_id = SeerWorkflowConfig.objects.get(id=config_id).service_account_id
    assert service_account_id is not None
    with assume_test_silo_mode(SiloMode.CONTROL):
        return ServiceAccount.objects.get(id=service_account_id)


def service_account_project_ids(account: ServiceAccount) -> list[int]:
    with assume_test_silo_mode(SiloMode.CONTROL):
        return sorted(
            ServiceAccountProject.objects.filter(service_account=account).values_list(
                "project_id", flat=True
            )
        )
