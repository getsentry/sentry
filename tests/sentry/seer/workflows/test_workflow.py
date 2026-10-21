from unittest.mock import patch

import pytest

from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowConfigProject,
    SeerWorkflowFilters,
    SeerWorkflowStrategy,
)
from sentry.seer.workflows.workflow import AllProjects, SeerWorkflow, SelectedProjects
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories


class SeerWorkflowEnsureDefaultsTest(TestCase):
    def test_seeds_defaults_once_per_organization(self) -> None:
        other = self.create_organization()
        Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE
        )
        first = self.create_project()

        SeerWorkflow.ensure_defaults(self.organization.id)
        (config,) = self.v2_configs()
        later = self.create_project()
        SeerWorkflow.ensure_defaults(self.organization.id)

        workflow = SeerWorkflow(config)
        assert self.v2_configs() == [config]
        assert self.v2_configs(other) == []
        assert workflow.filters.all_projects is True
        assert workflow.filters.environments == []
        assert workflow.extras.seeded_default == SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        assert workflow.get_project_ids() == [first.id, later.id]

    def test_existing_disabled_config_is_not_reseeded_or_changed(self) -> None:
        selected = self.create_project()
        existing = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            enabled=False,
            filters={"environments": ["production"]},
            version=3,
        )
        Factories.create_seer_workflow_config_project(existing, selected)

        SeerWorkflow.ensure_defaults(self.organization.id)

        (config,) = self.v2_configs()
        assert config.id == existing.id
        assert config.enabled is False
        assert config.filters == {"environments": ["production"]}
        assert config.version == 3
        assert SeerWorkflow(config).extras.seeded_default is None
        assert SeerWorkflow(config).get_project_ids() == [selected.id]

    def v2_configs(self, organization: Organization | None = None) -> list[SeerWorkflowConfig]:
        return list(
            SeerWorkflowConfig.objects.filter(
                organization=organization or self.organization,
                strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            ).order_by("id")
        )


class SeerWorkflowProjectSelectionTest(TestCase):
    def test_selected_projects_exclude_inactive_and_deleted_projects(self) -> None:
        first, second = self.create_project(), self.create_project()
        self.create_project()
        workflow = SeerWorkflow(self.create_config(first, second))
        assert workflow.get_project_ids() == [first.id, second.id]

        first.update(status=ObjectStatus.PENDING_DELETION)
        assert workflow.get_project_ids() == [second.id]

        second.delete()
        assert workflow.get_project_ids() == []
        assert workflow.filters.all_projects is False

    def test_replaces_selection_preserving_latest_filters_and_version(self) -> None:
        previous, selected = self.create_project(), self.create_project()
        config = self.create_config(previous)
        other_config = self.create_config(previous)
        workflow = SeerWorkflow(config)
        SeerWorkflowConfig.objects.filter(id=config.id, organization=self.organization).update(
            filters=SeerWorkflowFilters(environments=["production"]).dict()
            | {"min_event_count": 10},
            version=3,
        )

        workflow.set_project_selection(SelectedProjects(project_ids=(selected.id, selected.id)))

        config.refresh_from_db()
        assert config.filters == {
            "all_projects": False,
            "environments": ["production"],
            "min_event_count": 10,
        }
        assert config.version == workflow.config.version == 4
        assert workflow.get_project_ids() == [selected.id]
        assert SeerWorkflow(other_config).get_project_ids() == [previous.id]

    def test_switching_to_all_projects_clears_links_and_scopes_active_projects(self) -> None:
        selected = self.create_project()
        self.create_project(organization=self.create_organization())
        self.create_project(status=ObjectStatus.PENDING_DELETION)
        config = self.create_config(selected)
        workflow = SeerWorkflow(config)
        initial_filters = workflow.filters
        assert initial_filters.all_projects is False

        workflow.set_project_selection(AllProjects())
        later = self.create_project()

        config.refresh_from_db()
        assert SeerWorkflow(config).filters.all_projects is True
        assert workflow.filters.all_projects is True
        assert workflow.get_project_ids() == [selected.id, later.id]
        assert not SeerWorkflowConfigProject.objects.filter(config=config).exists()
        assert config.version == 2

    def test_empty_selection_switches_from_all_to_no_projects(self) -> None:
        self.create_project()
        config = self.create_config(all_projects=True)
        workflow = SeerWorkflow(config)

        workflow.set_project_selection(SelectedProjects(project_ids=()))

        config.refresh_from_db()
        assert SeerWorkflow(config).filters.all_projects is False
        assert workflow.get_project_ids() == []
        assert not SeerWorkflowConfigProject.objects.filter(config=config).exists()
        assert config.version == 2

    def test_rejects_cross_organization_projects_without_changing_selection(self) -> None:
        previous, valid = self.create_project(), self.create_project()
        foreign = self.create_project(organization=self.create_organization())
        config = self.create_config(previous)
        workflow = SeerWorkflow(config)

        with pytest.raises(ValueError, match="Selected projects must exist"):
            workflow.set_project_selection(SelectedProjects(project_ids=(valid.id, foreign.id)))

        config.refresh_from_db()
        assert workflow.get_project_ids() == [previous.id]
        assert config.filters == {"all_projects": False}
        assert config.version == 1

    def test_failed_insert_restores_previous_selection(self) -> None:
        previous, selected = self.create_project(), self.create_project()
        config = self.create_config(previous)
        workflow = SeerWorkflow(config)

        with (
            patch.object(
                SeerWorkflowConfigProject.objects, "bulk_create", side_effect=RuntimeError("failed")
            ),
            pytest.raises(RuntimeError, match="failed"),
        ):
            workflow.set_project_selection(SelectedProjects(project_ids=(selected.id,)))

        config.refresh_from_db()
        assert workflow.get_project_ids() == [previous.id]
        assert config.filters == {"all_projects": False}
        assert config.version == 1

    def create_config(self, *selected: Project, all_projects: bool = False) -> SeerWorkflowConfig:
        config = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            filters={"all_projects": all_projects},
        )
        for project in selected:
            Factories.create_seer_workflow_config_project(config, project)
        return config
