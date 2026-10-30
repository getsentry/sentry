from datetime import datetime, timedelta

from django.db import connections, router
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.db.models.fields.bounded import I64_MAX
from sentry.models.project import Project
from sentry.seer.endpoints.organization_seer_workflow_configs import serialize_workflow_configs
from sentry.seer.models.workflow import (
    MAX_WORKFLOW_CONFIGS_PER_ORG,
    SeerWorkflowConfig,
    SeerWorkflowConfigProject,
    SeerWorkflowRunStatus,
    SeerWorkflowStrategy,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.features import with_feature
from sentry.users.models.user import User


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
            datetime.fromisoformat(response.json()["configs"][0]["dateLastRun"])
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

        assert len(queries) == 2
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

    def test_put_without_changes_keeps_version(self) -> None:
        config = self.create_config(version=3)
        Factories.create_seer_workflow_config_project(config, self.project)

        for body in ({"projectIds": [self.project.id]}, {}):
            response = self.get_success_response(
                self.organization.slug, config.id, method="put", **body
            )
            assert response.data["version"] == 3
        assert self.selected_project_ids(config) == [self.project.id]

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

    def test_member_cannot_narrow_all_projects_config(self) -> None:
        member, accessible = self.create_member_with_project(open_membership=False)
        config = self.create_config(filters={"all_projects": True})
        self.login_as(member)

        self.get_error_response(
            self.organization.slug,
            config.id,
            method="put",
            projectIds=[accessible.id],
            status_code=403,
        )

        config.refresh_from_db()
        assert config.filters["all_projects"] is True
        assert self.selected_project_ids(config) == []

    def test_member_cannot_put_all_projects(self) -> None:
        member, accessible = self.create_member_with_project(open_membership=False)
        config = self.create_config()
        Factories.create_seer_workflow_config_project(config, accessible)
        self.login_as(member)

        self.get_error_response(
            self.organization.slug, config.id, method="put", projectIds=[-1], status_code=403
        )

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

    def create_config(self, **kwargs) -> SeerWorkflowConfig:
        return Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2, **kwargs
        )


@override_settings(SENTRY_SELF_HOSTED=False)
@with_feature("organizations:seer-automations")
class OrganizationSeerWorkflowConfigCreateTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-workflow-configs"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

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
            "environments": [],
            "filters": {},
            "outputPolicy": {},
            "seededDefault": None,
            "dateAdded": config.date_added,
            "dateUpdated": config.date_updated,
        }
        assert config.extras == {}

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
        assert config.extras == {"name": "Checkout triage"}
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

        for project_ids in ([accessible.id, hidden.id], [-1]):
            self.get_error_response(
                self.organization.slug,
                strategy="agentic_triage_v2",
                projectIds=project_ids,
                status_code=403,
            )
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

        self.get_error_response(
            self.organization.slug, strategy="agentic_triage_v2", status_code=400
        )

        assert (
            SeerWorkflowConfig.objects.filter(
                organization=self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
            ).count()
            == MAX_WORKFLOW_CONFIGS_PER_ORG
        )

    def test_rate_limits_creation(self) -> None:
        for _ in range(5):
            self.get_success_response(
                self.organization.slug, strategy="agentic_triage_v2", status_code=201
            )
        self.get_error_response(
            self.organization.slug, strategy="agentic_triage_v2", status_code=429
        )

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
