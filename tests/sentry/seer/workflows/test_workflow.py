from unittest.mock import patch

import pytest

from sentry.constants import ObjectStatus
from sentry.deletions.tasks.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.hybridcloud.models.outbox import outbox_context
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowConfigProject,
    SeerWorkflowFilters,
    SeerWorkflowStrategy,
)
from sentry.seer.workflows.workflow import AllProjects, SeerWorkflow, SelectedProjects
from sentry.service_accounts.models import ServiceAccountReplica
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, cell_silo_test


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


class SeerWorkflowScopeTest(TestCase):
    def test_scope_requires_active_project_in_organization(self) -> None:
        config = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            enabled=True,
            filters={"all_projects": False},
        )
        selected = self.create_project(organization=self.organization)
        Factories.create_seer_workflow_config_project(config, selected)
        workflow = SeerWorkflow(config)

        assert workflow.matches_scope(selected.id, None) is True
        later = self.create_project(organization=self.organization)
        assert workflow.matches_scope(later.id, None) is False
        workflow.set_project_selection(AllProjects())
        assert workflow.matches_scope(later.id, None) is True
        foreign = self.create_project(organization=self.create_organization())
        assert workflow.matches_scope(foreign.id, None) is False

        selected.update(status=ObjectStatus.PENDING_DELETION)
        assert workflow.matches_scope(selected.id, None) is False

    def test_scope_requires_enabled_config_and_matching_environment(self) -> None:
        config = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            enabled=True,
            filters={"all_projects": True, "environments": ["production"]},
        )

        workflow = SeerWorkflow(config)
        assert workflow.matches_scope(self.project.id, "production") is True
        assert workflow.matches_scope(self.project.id, "staging") is False
        assert workflow.matches_scope(self.project.id, None) is False

        config.update(enabled=False)

        assert workflow.matches_scope(self.project.id, "production") is False


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


@cell_silo_test
class SeerWorkflowServiceAccountTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.config = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            filters={"environments": ["production"]},
            output_policy={"notify": True},
        )
        self.workflow = SeerWorkflow(self.config)
        with outbox_runner():
            self.account = Factories.create_service_account(self.organization, id=910001)

    def test_assigns_authoritative_identity_and_preserves_latest_settings(self) -> None:
        with outbox_runner():
            unrelated = Factories.create_service_account(self.organization, name="unrelated")
        ServiceAccountReplica.objects.filter(service_account_id=unrelated.id).update(
            id=self.account.id
        )
        replica = ServiceAccountReplica.objects.get(service_account_id=self.account.id)
        assert replica.id != self.account.id
        SeerWorkflowConfig.objects.filter(id=self.config.id).update(version=4, enabled=True)

        self.workflow.set_service_account(self.account.id)

        self.config.refresh_from_db()
        assert self.config.service_account_id == self.account.id
        assert self.config.version == self.workflow.config.version == 5
        assert self.config.enabled is True
        assert self.config.filters == {"environments": ["production"]}
        assert self.config.output_policy == {"notify": True}
        assert self.workflow.resolve_service_account().service_account_id == self.account.id

    def test_assignment_versions_only_changes(self) -> None:
        self.workflow.set_service_account(None)
        assert self.workflow.config.version == 1
        self.workflow.set_service_account(self.account.id)
        self.workflow.set_service_account(self.account.id)
        assert self.workflow.config.version == 2

        with outbox_runner():
            replacement = Factories.create_service_account(self.organization, name="replacement")
        self.workflow.set_service_account(replacement.id)
        assert self.workflow.config.version == 3
        self.workflow.set_service_account(None)
        assert self.workflow.config.version == 4
        self.workflow.set_service_account(None)
        assert self.workflow.config.version == 4

    def test_rejects_unavailable_and_inactive_accounts_without_mutation(self) -> None:
        self.workflow.set_service_account(self.account.id)
        with outbox_runner():
            inactive = Factories.create_service_account(
                self.organization, name="inactive", is_active=False
            )
            foreign = Factories.create_service_account(self.create_organization())
        for account_id, message in [
            (inactive.id, "inactive"),
            (foreign.id, "unavailable"),
            (999999999, "unavailable"),
        ]:
            with pytest.raises(ValueError, match=message):
                self.workflow.set_service_account(account_id)
            self.config.refresh_from_db()
            assert self.config.service_account_id == self.account.id
            assert self.config.version == 2

    def test_failed_save_rolls_back_association_and_version(self) -> None:
        with (
            patch.object(SeerWorkflowConfig, "save", side_effect=RuntimeError("failed")),
            pytest.raises(RuntimeError, match="failed"),
        ):
            self.workflow.set_service_account(self.account.id)
        self.config.refresh_from_db()
        assert self.config.service_account_id is None
        assert self.config.version == 1

    def test_assignment_can_retry_after_replication(self) -> None:
        with outbox_context(flush=False):
            pending = Factories.create_service_account(self.organization, name="pending")
        with pytest.raises(ValueError, match="unavailable"):
            self.workflow.set_service_account(pending.id)
        self.config.refresh_from_db()
        assert self.config.service_account_id is None
        assert self.config.version == 1
        with outbox_runner():
            pass
        self.workflow.set_service_account(pending.id)
        assert self.workflow.resolve_service_account().service_account_id == pending.id

    def test_resolution_reads_current_replica_state(self) -> None:
        self.workflow.set_service_account(self.account.id)
        assert self.workflow.resolve_service_account().is_active
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.account.update(name="updated", scope_list=["project:read"])
        resolved = self.workflow.resolve_service_account()
        assert resolved.name == "updated"
        assert resolved.scope_list == ["project:read"]
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.account.update(is_active=False)
        with pytest.raises(ValueError, match="inactive"):
            self.workflow.resolve_service_account()
        with pytest.raises(ValueError, match="inactive"):
            self.workflow.set_service_account(self.account.id)
        self.config.refresh_from_db()
        assert self.config.service_account_id == self.account.id
        assert self.config.version == 2

    def test_resolution_rejects_unset_and_differently_owned_associations(self) -> None:
        with pytest.raises(ValueError, match="no service account"):
            self.workflow.resolve_service_account()
        with outbox_runner():
            foreign = Factories.create_service_account(self.create_organization())
        self.workflow.config.service_account_id = foreign.id
        with pytest.raises(ValueError, match="unavailable"):
            self.workflow.resolve_service_account()

    def test_control_deletion_clears_associations_and_rejects_stale_wrapper(self) -> None:
        selected = self.create_project()
        Factories.create_seer_workflow_config_project(self.config, selected)
        self.workflow.set_service_account(self.account.id)
        other = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
        )
        SeerWorkflow(other).set_service_account(self.account.id)
        with outbox_runner():
            unrelated = Factories.create_service_account(self.organization, name="unrelated")
        unrelated_workflow = SeerWorkflow(
            Factories.create_seer_workflow_config(
                self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
            )
        )
        unrelated_workflow.set_service_account(unrelated.id)
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.account.delete()
        with self.tasks():
            schedule_hybrid_cloud_foreign_key_jobs()
            schedule_hybrid_cloud_foreign_key_jobs()
        self.config.refresh_from_db()
        other.refresh_from_db()
        assert self.config.service_account_id is None
        assert other.service_account_id is None
        assert self.config.filters == {"environments": ["production"]}
        assert self.config.output_policy == {"notify": True}
        assert self.config.version == 2
        assert self.workflow.get_project_ids() == [selected.id]
        assert unrelated_workflow.resolve_service_account().service_account_id == unrelated.id
        with pytest.raises(ValueError, match="unavailable"):
            self.workflow.resolve_service_account()

    def test_assignment_during_delayed_account_deletion_is_eventually_cleared(self) -> None:
        account_id = self.account.id
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_context(flush=False):
            self.account.delete()
        # Control deletion has not reached the cell, so assignment sees the active replica.
        self.workflow.set_service_account(account_id)
        with outbox_runner():
            pass
        with self.tasks():
            schedule_hybrid_cloud_foreign_key_jobs()
        self.config.refresh_from_db()
        assert self.config.service_account_id is None
        assert self.config.version == 2

    def test_missing_replica_does_not_clear_account_identity(self) -> None:
        self.workflow.set_service_account(self.account.id)
        ServiceAccountReplica.objects.filter(service_account_id=self.account.id).delete()
        with pytest.raises(ValueError, match="unavailable"):
            self.workflow.resolve_service_account()
        self.config.refresh_from_db()
        assert self.config.service_account_id == self.account.id
        assert self.config.version == 2
