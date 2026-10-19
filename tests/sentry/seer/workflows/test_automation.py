from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.models.workflow import SeerWorkflowConfig, SeerWorkflowStrategy
from sentry.seer.workflows.automation import SeerAutomation
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories


class SeerAutomationEnsureDefaultsTest(TestCase):
    def v2_configs(self, organization: Organization | None = None) -> list[SeerWorkflowConfig]:
        return list(
            SeerWorkflowConfig.objects.filter(
                organization=organization or self.organization,
                strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            ).order_by("id")
        )

    def test_seeds_one_default_covering_all_projects(self) -> None:
        first = self.create_project()
        SeerAutomation.ensure_defaults(self.organization.id)
        later = self.create_project()

        (config,) = self.v2_configs()
        assert SeerAutomation(config).filters.all_projects is True
        assert SeerAutomation(config).filters.environments == []
        assert config.extras == {"seeded_default": "agentic_triage_v2"}
        assert SeerAutomation(config).get_project_ids() == [first.id, later.id]

    def test_seeding_twice_creates_nothing_new(self) -> None:
        SeerAutomation.ensure_defaults(self.organization.id)
        (seeded,) = self.v2_configs()

        SeerAutomation.ensure_defaults(self.organization.id)

        assert self.v2_configs() == [seeded]

    def test_existing_config_prevents_seeding_and_is_left_unchanged(self) -> None:
        selected = self.create_project()
        self.create_project()
        existing = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            enabled=True,
            filters={"environments": ["production"]},
            version=3,
        )
        Factories.create_seer_workflow_config_project(existing, selected)

        SeerAutomation.ensure_defaults(self.organization.id)

        (config,) = self.v2_configs()
        assert config.id == existing.id
        assert config.enabled is True
        assert SeerAutomation(config).filters.all_projects is False
        assert SeerAutomation(config).filters.environments == ["production"]
        assert config.version == 3
        assert config.extras == {}
        assert SeerAutomation(config).get_project_ids() == [selected.id]

    def test_disabled_config_prevents_seeding(self) -> None:
        disabled = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2, enabled=False
        )

        SeerAutomation.ensure_defaults(self.organization.id)

        assert self.v2_configs() == [disabled]

    def test_legacy_configs_do_not_count_as_defaults(self) -> None:
        legacy = SeerWorkflowConfig.get_or_create_for_strategy(
            self.organization.id, SeerWorkflowStrategy.AGENTIC_TRIAGE
        )

        SeerAutomation.ensure_defaults(self.organization.id)

        assert len(self.v2_configs()) == 1
        assert (
            SeerWorkflowConfig.objects.get(
                organization=self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE
            )
            == legacy
        )
        assert legacy.extras == {}

    def test_seeding_one_organization_does_not_affect_another(self) -> None:
        other = self.create_organization()

        SeerAutomation.ensure_defaults(self.organization.id)

        assert len(self.v2_configs()) == 1
        assert self.v2_configs(other) == []

        SeerAutomation.ensure_defaults(other.id)

        assert len(self.v2_configs()) == 1
        assert len(self.v2_configs(other)) == 1


class SeerAutomationProjectIdsTest(TestCase):
    def create_config(self, *selected: Project, all_projects: bool = False) -> SeerWorkflowConfig:
        config = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            filters={"all_projects": all_projects},
        )
        for project in selected:
            Factories.create_seer_workflow_config_project(config, project)
        return config

    def test_all_projects_covers_projects_created_later(self) -> None:
        first = self.create_project()
        config = self.create_config(all_projects=True)
        later = self.create_project()
        other_organization_project = self.create_project(organization=self.create_organization())

        assert SeerAutomation(config).get_project_ids() == [first.id, later.id]
        assert other_organization_project.id not in SeerAutomation(config).get_project_ids()

    def test_all_projects_skips_inactive_projects(self) -> None:
        active = self.create_project()
        pending_deletion = self.create_project()
        pending_deletion.update(status=ObjectStatus.PENDING_DELETION)

        config = self.create_config(all_projects=True)

        assert SeerAutomation(config).get_project_ids() == [active.id]

    def test_all_projects_in_organization_without_active_projects_is_empty(self) -> None:
        config = self.create_config(all_projects=True)

        assert SeerAutomation(config).get_project_ids() == []
        assert SeerAutomation(config).filters.all_projects is True

    def test_selected_projects_cover_only_those_still_active(self) -> None:
        a, b, c = self.create_project(), self.create_project(), self.create_project()
        self.create_project()
        config = self.create_config(a, b, c)

        assert SeerAutomation(config).get_project_ids() == [a.id, b.id, c.id]

        a.update(status=ObjectStatus.PENDING_DELETION)
        assert SeerAutomation(config).get_project_ids() == [b.id, c.id]

        b.delete()
        assert SeerAutomation(config).get_project_ids() == [c.id]

    def test_pending_deletion_of_every_selected_project_does_not_widen_to_all(self) -> None:
        selected = [self.create_project(), self.create_project()]
        self.create_project()
        config = self.create_config(*selected)

        for project in selected:
            project.update(status=ObjectStatus.PENDING_DELETION)

        assert SeerAutomation(config).get_project_ids() == []
        config.refresh_from_db()
        assert SeerAutomation(config).filters.all_projects is False

    def test_deleting_every_selected_project_does_not_widen_to_all(self) -> None:
        selected = [self.create_project(), self.create_project()]
        self.create_project()
        config = self.create_config(*selected)

        for project in selected:
            project.delete()

        assert SeerAutomation(config).get_project_ids() == []
        config.refresh_from_db()
        assert SeerAutomation(config).filters.all_projects is False

    def test_config_without_all_projects_key_covers_no_projects(self) -> None:
        self.create_project()
        config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2, filters={}
        )

        assert SeerAutomation(config).get_project_ids() == []
