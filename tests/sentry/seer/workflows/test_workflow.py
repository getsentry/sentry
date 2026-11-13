from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from django.db import router, transaction

from sentry.cadence.api import ScheduledTriggerType, get_schedules
from sentry.constants import ObjectStatus
from sentry.deletions.tasks.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.hybridcloud.models.outbox import CellOutbox, OutboxDatabaseError, outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowConfigExtras,
    SeerWorkflowConfigProject,
    SeerWorkflowFilters,
    SeerWorkflowSchedule,
    SeerWorkflowStrategy,
)
from sentry.seer.workflows.base import (
    AllProjects,
    SeerServiceAccountGrant,
    SelectedMonitors,
    SelectedProjects,
    WorkflowUpdateError,
)
from sentry.seer.workflows.workflow import (
    SEER_WORKFLOW_SERVICE_ACCOUNT_OWNER,
    SeerWorkflow,
)
from sentry.service_accounts.models import (
    ServiceAccount,
    ServiceAccountProject,
    ServiceAccountReplica,
)
from sentry.service_accounts.outbox import ServiceAccountCreatePayload, create_owned_service_account
from sentry.service_accounts.services.service_account import service_account_service
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, cell_silo_test

GRANT = SeerServiceAccountGrant(scopes=["event:read"])


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

        workflow = SeerWorkflow(config_id=config.id, organization_id=config.organization_id)
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
        workflow = SeerWorkflow(config_id=config.id, organization_id=config.organization_id)
        assert workflow.extras.seeded_default is None
        assert workflow.get_project_ids() == [selected.id]

    def v2_configs(self, organization: Organization | None = None) -> list[SeerWorkflowConfig]:
        return list(
            SeerWorkflowConfig.objects.filter(
                organization=organization or self.organization,
                strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            ).order_by("id")
        )


class SeerWorkflowCreateTest(TestCase):
    def test_creates_config_with_selected_projects(self) -> None:
        first, second = self.create_project(), self.create_project()

        workflow = SeerWorkflow.create(
            organization_id=self.organization.id,
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            enabled=True,
            schedule=SeerWorkflowSchedule.DAILY,
            scope=SelectedProjects((second.id, first.id)),
            environments=["production"],
            extras=SeerWorkflowConfigExtras(name="Daily triage", created_by=self.user.id),
            service_account_grant=SeerServiceAccountGrant(
                scopes=["event:read"], project_ids=[first.id]
            ),
        )

        config = workflow.get_config()
        assert config.service_account_id is not None
        with assume_test_silo_mode(SiloMode.CONTROL):
            account = ServiceAccount.objects.get(id=config.service_account_id)
            assert account.name == f"Seer: Daily triage #{config.id}"
            assert account.scope_list == ["event:read"]
            assert account.created_by_id == self.user.id
            assert list(
                ServiceAccountProject.objects.filter(service_account=account).values_list(
                    "project_id", flat=True
                )
            ) == [first.id]
        assert config.strategy == SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        assert config.enabled is True
        assert config.schedule == SeerWorkflowSchedule.DAILY
        assert config.filters == {"all_projects": False, "environments": ["production"]}
        assert workflow.extras.name == "Daily triage"
        assert config.version == 1
        assert workflow.get_project_ids() == sorted([first.id, second.id])

    def test_creates_all_projects_config_without_links(self) -> None:
        project = self.create_project()

        workflow = SeerWorkflow.create(
            organization_id=self.organization.id,
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            schedule=SeerWorkflowSchedule.DAILY,
            scope=AllProjects(),
            service_account_grant=GRANT,
        )

        config = workflow.get_config()
        assert config.enabled is False
        assert config.filters == {"all_projects": True, "environments": []}
        assert workflow.extras.name is None
        assert not SeerWorkflowConfigProject.objects.filter(config=config).exists()
        assert workflow.get_project_ids() == [project.id]

    def test_rejects_unconfigurable_strategy(self) -> None:
        with pytest.raises(WorkflowUpdateError, match="cannot be configured"):
            SeerWorkflow.create(  # type: ignore[call-overload]
                organization_id=self.organization.id,
                strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE,
                schedule=SeerWorkflowSchedule.DAILY,
                scope=SelectedProjects(()),
                service_account_grant=GRANT,
            )
        assert not SeerWorkflowConfig.objects.exists()

    def test_rejects_project_scope_for_monitor_scoped_strategy(self) -> None:
        with pytest.raises(WorkflowUpdateError, match="selected by connecting monitors"):
            SeerWorkflow.create(  # type: ignore[call-overload]
                organization_id=self.organization.id,
                strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
                scope=SelectedProjects(()),
                service_account_grant=GRANT,
            )
        assert not SeerWorkflowConfig.objects.exists()

    def test_rejects_settings_the_trigger_does_not_take(self) -> None:
        with pytest.raises(WorkflowUpdateError, match="cron"):
            SeerWorkflow.create(
                organization_id=self.organization.id,
                strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
                scope=SelectedMonitors(()),
                extras=SeerWorkflowConfigExtras(trigger_settings={"cron": "0 9 * * 1"}),
                service_account_grant=GRANT,
            )
        with pytest.raises(WorkflowUpdateError, match="cron"):
            SeerWorkflow.create(
                organization_id=self.organization.id,
                strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
                scope=AllProjects(),
                extras=SeerWorkflowConfigExtras(trigger_settings={"cron": "not a cron"}),
                service_account_grant=GRANT,
            )
        assert not SeerWorkflowConfig.objects.exists()

    def test_rejects_other_org_project(self) -> None:
        foreign = self.create_project(organization=self.create_organization())

        with pytest.raises(WorkflowUpdateError, match="must exist in the workflow's organization"):
            SeerWorkflow.create(
                organization_id=self.organization.id,
                strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
                schedule=SeerWorkflowSchedule.DAILY,
                scope=SelectedProjects((self.project.id, foreign.id)),
                service_account_grant=GRANT,
            )
        with pytest.raises(WorkflowUpdateError, match="must exist in the workflow's organization"):
            SeerWorkflow.create(
                organization_id=self.organization.id,
                strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
                schedule=SeerWorkflowSchedule.DAILY,
                scope=SelectedProjects((self.project.id,)),
                service_account_grant=SeerServiceAccountGrant(
                    scopes=["event:read"], project_ids=[foreign.id]
                ),
            )
        assert not SeerWorkflowConfig.objects.exists()
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not ServiceAccount.objects.exists()

    @patch("sentry.seer.workflows.workflow.MAX_WORKFLOW_CONFIGS_PER_ORG", 2)
    def test_caps_configs_per_organization(self) -> None:
        for _ in range(2):
            Factories.create_seer_workflow_config(
                self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
            )

        with pytest.raises(WorkflowUpdateError, match="at most 2 automations"):
            SeerWorkflow.create(
                organization_id=self.organization.id,
                strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
                schedule=SeerWorkflowSchedule.DAILY,
                scope=SelectedProjects((self.project.id,)),
                service_account_grant=GRANT,
            )
        assert SeerWorkflowConfig.objects.filter(organization=self.organization).count() == 2
        assert not SeerWorkflowConfigProject.objects.exists()


class SeerWorkflowServiceAccountOutboxTest(TestCase):
    def create_workflow_while_control_is_down(self) -> SeerWorkflow:
        with patch.object(
            service_account_service,
            "create_service_account",
            side_effect=RuntimeError("control unavailable"),
        ):
            return SeerWorkflow.create(
                organization_id=self.organization.id,
                strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
                schedule=SeerWorkflowSchedule.DAILY,
                scope=SelectedProjects((self.project.id,)),
                service_account_grant=SeerServiceAccountGrant(
                    scopes=["event:read"], project_ids=[self.project.id]
                ),
            )

    def pending_outbox(self) -> CellOutbox:
        return CellOutbox.objects.get(category=OutboxCategory.SERVICE_ACCOUNT_CREATE)

    def pending_payload(self) -> ServiceAccountCreatePayload:
        payload = self.pending_outbox().payload
        assert payload is not None
        return payload

    def account_count(self) -> int:
        with assume_test_silo_mode(SiloMode.CONTROL):
            return ServiceAccount.objects.filter(organization_id=self.organization.id).count()

    def test_control_failure_keeps_config_and_retries(self) -> None:
        workflow = self.create_workflow_while_control_is_down()

        assert workflow.get_config().service_account_id is None
        assert self.account_count() == 0

        self.pending_outbox().drain_shard()

        account_id = workflow.get_config().service_account_id
        assert account_id is not None
        assert not CellOutbox.objects.filter(
            category=OutboxCategory.SERVICE_ACCOUNT_CREATE
        ).exists()
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ServiceAccount.objects.get(id=account_id).scope_list == ["event:read"]

    def test_flush_database_error_keeps_config_for_retry(self) -> None:
        organization, project = self.organization, self.project
        with patch.object(
            CellOutbox, "drain_shard", side_effect=OutboxDatabaseError("connection lost")
        ):
            workflow = SeerWorkflow.create(
                organization_id=organization.id,
                strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
                schedule=SeerWorkflowSchedule.DAILY,
                scope=SelectedProjects((project.id,)),
                service_account_grant=SeerServiceAccountGrant(
                    scopes=["event:read"], project_ids=[project.id]
                ),
            )

        assert workflow.get_config().service_account_id is None
        self.pending_outbox().drain_shard()
        assert workflow.get_config().service_account_id is not None

    def test_redelivery_reuses_the_account(self) -> None:
        workflow = self.create_workflow_while_control_is_down()
        payload = self.pending_payload()
        create_owned_service_account(
            self.organization.id, payload, SEER_WORKFLOW_SERVICE_ACCOUNT_OWNER
        )
        account_id = workflow.get_config().service_account_id

        # Control created the account, but the cell lost the link before the outbox cleared.
        SeerWorkflowConfig.objects.filter(id=workflow.config_id).update(service_account_id=None)
        create_owned_service_account(
            self.organization.id, payload, SEER_WORKFLOW_SERVICE_ACCOUNT_OWNER
        )

        assert workflow.get_config().service_account_id == account_id
        assert self.account_count() == 1

    def test_rejected_account_leaves_config_unlinked(self) -> None:
        workflow = self.create_workflow_while_control_is_down()
        payload = self.pending_payload()
        Factories.create_service_account(self.organization, name=payload["name"])

        # Raising would block the shard on a grant that retrying can't fix.
        self.pending_outbox().drain_shard()

        assert workflow.get_config().service_account_id is None
        assert self.account_count() == 1

    def test_config_deleted_before_delivery_creates_no_account(self) -> None:
        workflow = self.create_workflow_while_control_is_down()
        outbox = self.pending_outbox()
        workflow.delete()

        outbox.drain_shard()

        assert self.account_count() == 0


class SeerWorkflowUpdateConfigTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.selected = self.create_project()
        self.config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        )
        Factories.create_seer_workflow_config_project(self.config, self.selected)
        self.workflow = SeerWorkflow(
            config_id=self.config.id, organization_id=self.config.organization_id
        )

    def test_changes_in_one_update_bump_version_once(self) -> None:
        with self.workflow.update_config() as update:
            update.set_enabled(True)
            update.set_scope(AllProjects())

        config = self.workflow.get_config()
        assert config.version == 2
        assert config.enabled is True
        assert self.workflow.filters.all_projects is True

    def test_unchanged_update_does_not_save(self) -> None:
        with self.workflow.update_config() as update:
            update.set_enabled(False)
            update.set_scope(SelectedProjects(project_ids=(self.selected.id,)))

        config = self.workflow.get_config()
        assert config.version == 1
        assert config.date_updated == self.config.date_updated

    def test_set_extras_saves_and_bumps_version(self) -> None:
        with self.workflow.update_config() as update:
            update.set_extras(SeerWorkflowConfigExtras(name="Triage", updated_by="bot"))

        config = self.workflow.get_config()
        assert config.extras == {"name": "Triage", "updated_by": "bot"}
        assert config.version == 2

    def test_unchanged_extras_does_not_save(self) -> None:
        with self.workflow.update_config() as update:
            update.set_extras(SeerWorkflowConfigExtras.parse_obj(self.config.extras))

        config = self.workflow.get_config()
        assert config.version == 1
        assert config.date_updated == self.config.date_updated

    def test_project_link_change_bumps_version(self) -> None:
        other = self.create_project()

        with self.workflow.update_config() as update:
            update.set_scope(SelectedProjects(project_ids=(other.id,)))

        assert self.workflow.get_config().version == 2
        assert self.workflow.filters.all_projects is False
        assert self.workflow.get_project_ids() == [other.id]

    def test_error_rolls_back_every_change(self) -> None:
        other = self.create_project()

        with pytest.raises(RuntimeError, match="failed"), self.workflow.update_config() as update:
            update.set_enabled(True)
            update.set_scope(SelectedProjects(project_ids=(other.id,)))
            raise RuntimeError("failed")

        config = self.workflow.get_config()
        assert config.version == 1
        assert config.enabled is False
        assert self.workflow.get_project_ids() == [self.selected.id]


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
        workflow = SeerWorkflow(config_id=config.id, organization_id=config.organization_id)

        assert workflow.matches_scope(selected.id, None) is True
        later = self.create_project(organization=self.organization)
        assert workflow.matches_scope(later.id, None) is False
        other = SeerWorkflow(config_id=config.id, organization_id=config.organization_id)
        with other.update_config() as update:
            update.set_scope(AllProjects())
        assert workflow.filters.all_projects is True
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

        workflow = SeerWorkflow(config_id=config.id, organization_id=config.organization_id)
        assert workflow.matches_scope(self.project.id, "production") is True
        assert workflow.matches_scope(self.project.id, "staging") is False
        assert workflow.matches_scope(self.project.id, None) is False

        SeerWorkflowConfig.objects.filter(id=config.id).update(enabled=False)

        assert workflow.matches_scope(self.project.id, "production") is False

    def test_reads_fresh_config_without_changing_previous_results(self) -> None:
        config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        )
        workflow = SeerWorkflow(config_id=config.id, organization_id=self.organization.id)
        original = workflow.get_config()

        SeerWorkflowConfig.objects.filter(id=config.id).update(
            filters={"all_projects": True, "environments": ["production"]},
            extras={"seeded_default": SeerWorkflowStrategy.AGENTIC_TRIAGE_V2},
            version=2,
        )

        assert original.version == 1
        assert workflow.get_config().version == 2
        assert workflow.filters.all_projects is True
        assert workflow.filters.environments == ["production"]
        assert workflow.extras.seeded_default == SeerWorkflowStrategy.AGENTIC_TRIAGE_V2

    def test_reads_and_changes_require_matching_organization(self) -> None:
        config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        )
        workflow = SeerWorkflow(config_id=config.id, organization_id=self.create_organization().id)

        with pytest.raises(SeerWorkflowConfig.DoesNotExist):
            workflow.get_config()
        with pytest.raises(SeerWorkflowConfig.DoesNotExist):
            workflow.get_project_ids()
        with pytest.raises(SeerWorkflowConfig.DoesNotExist):
            with workflow.update_config() as update:
                update.set_scope(AllProjects())

        config.refresh_from_db()
        assert config.version == 1


class SeerWorkflowProjectSelectionTest(TestCase):
    def test_selected_projects_exclude_inactive_and_deleted_projects(self) -> None:
        first, second = self.create_project(), self.create_project()
        self.create_project()
        config = self.create_config(first, second)
        workflow = SeerWorkflow(config_id=config.id, organization_id=self.organization.id)
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
        workflow = SeerWorkflow(config_id=config.id, organization_id=config.organization_id)
        SeerWorkflowConfig.objects.filter(id=config.id, organization=self.organization).update(
            filters=SeerWorkflowFilters(environments=["production"]).dict()
            | {"min_event_count": 10},
            version=3,
        )

        with workflow.update_config() as update:
            update.set_scope(SelectedProjects(project_ids=(selected.id, selected.id)))
        config.refresh_from_db()
        assert config.filters == {
            "all_projects": False,
            "environments": ["production"],
            "min_event_count": 10,
        }
        assert config.version == workflow.get_config().version == 4
        assert workflow.get_project_ids() == [selected.id]
        assert SeerWorkflow(
            config_id=other_config.id, organization_id=other_config.organization_id
        ).get_project_ids() == [previous.id]

    def test_switching_to_all_projects_clears_links_and_scopes_active_projects(self) -> None:
        selected = self.create_project()
        self.create_project(organization=self.create_organization())
        self.create_project(status=ObjectStatus.PENDING_DELETION)
        config = self.create_config(selected)
        workflow = SeerWorkflow(config_id=config.id, organization_id=config.organization_id)
        initial_filters = workflow.filters
        assert initial_filters.all_projects is False

        with workflow.update_config() as update:
            update.set_scope(AllProjects())
        later = self.create_project()

        config.refresh_from_db()
        assert (
            SeerWorkflow(
                config_id=config.id, organization_id=config.organization_id
            ).filters.all_projects
            is True
        )
        assert workflow.filters.all_projects is True
        assert workflow.get_project_ids() == [selected.id, later.id]
        assert not SeerWorkflowConfigProject.objects.filter(config=config).exists()
        assert config.version == 2

    def test_empty_selection_switches_from_all_to_no_projects(self) -> None:
        self.create_project()
        config = self.create_config(all_projects=True)
        workflow = SeerWorkflow(config_id=config.id, organization_id=config.organization_id)

        with workflow.update_config() as update:
            update.set_scope(SelectedProjects(project_ids=()))
        config.refresh_from_db()
        assert (
            SeerWorkflow(
                config_id=config.id, organization_id=config.organization_id
            ).filters.all_projects
            is False
        )
        assert workflow.get_project_ids() == []
        assert not SeerWorkflowConfigProject.objects.filter(config=config).exists()
        assert config.version == 2

    def test_rejects_cross_organization_projects_without_changing_selection(self) -> None:
        previous, valid = self.create_project(), self.create_project()
        foreign = self.create_project(organization=self.create_organization())
        config = self.create_config(previous)
        workflow = SeerWorkflow(config_id=config.id, organization_id=config.organization_id)

        with pytest.raises(ValueError, match="Selected projects must exist"):
            with workflow.update_config() as update:
                update.set_scope(SelectedProjects(project_ids=(valid.id, foreign.id)))
        config.refresh_from_db()
        assert workflow.get_project_ids() == [previous.id]
        assert config.filters == {"all_projects": False}
        assert config.version == 1

    def test_failed_insert_restores_previous_selection(self) -> None:
        previous, selected = self.create_project(), self.create_project()
        config = self.create_config(previous)
        workflow = SeerWorkflow(config_id=config.id, organization_id=config.organization_id)

        with (
            patch.object(
                SeerWorkflowConfigProject.objects, "bulk_create", side_effect=RuntimeError("failed")
            ),
            pytest.raises(RuntimeError, match="failed"),
        ):
            with workflow.update_config() as update:
                update.set_scope(SelectedProjects(project_ids=(selected.id,)))
        config.refresh_from_db()
        assert workflow.get_project_ids() == [previous.id]
        assert config.filters == {"all_projects": False}
        assert config.version == 1

    def test_outer_rollback_does_not_leave_stale_config(self) -> None:
        previous = self.create_project()
        config = self.create_config(previous)
        workflow = SeerWorkflow(config_id=config.id, organization_id=self.organization.id)

        with (
            pytest.raises(RuntimeError, match="failed"),
            transaction.atomic(router.db_for_write(SeerWorkflowConfig)),
        ):
            with workflow.update_config() as update:
                update.set_scope(AllProjects())
            assert workflow.filters.all_projects is True
            raise RuntimeError("failed")

        assert workflow.filters.all_projects is False
        assert workflow.get_config().version == 1
        assert workflow.get_project_ids() == [previous.id]

    def test_has_all_projects_with_all_projects_flag(self) -> None:
        self.create_project()
        self.create_project(status=ObjectStatus.PENDING_DELETION)
        self.create_project(organization=self.create_organization())
        config = self.create_config(all_projects=True)
        workflow = SeerWorkflow(config_id=config.id, organization_id=config.organization_id)

        assert workflow.has_all_projects() is True

        self.create_project()
        assert workflow.has_all_projects() is True

    def test_has_all_projects_requires_every_active_project_selected(self) -> None:
        first, second = self.create_project(), self.create_project()
        self.create_project(status=ObjectStatus.PENDING_DELETION)
        config = self.create_config(first)
        workflow = SeerWorkflow(config_id=config.id, organization_id=config.organization_id)

        assert workflow.has_all_projects() is False

        # An explicit selection of every active project counts, even without the flag.
        with workflow.update_config() as update:
            update.set_scope(SelectedProjects(project_ids=(first.id, second.id)))
        assert workflow.filters.all_projects is False
        assert workflow.has_all_projects() is True

        self.create_project()
        assert workflow.has_all_projects() is False

    def test_has_all_projects_without_active_projects(self) -> None:
        organization = self.create_organization()
        project = self.create_project(
            organization=organization, status=ObjectStatus.PENDING_DELETION
        )
        config = Factories.create_seer_workflow_config(
            organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        )
        workflow = SeerWorkflow(config_id=config.id, organization_id=config.organization_id)

        # An empty scope never counts as all projects, even with no active projects.
        assert workflow.get_project_ids() == []
        assert workflow.has_all_projects() is False

        with workflow.update_config() as update:
            update.set_scope(SelectedProjects(project_ids=(project.id,)))
        assert workflow.has_all_projects() is False

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
        self.workflow = SeerWorkflow(
            config_id=self.config.id, organization_id=self.config.organization_id
        )
        with outbox_runner():
            self.account = Factories.create_service_account(self.organization, id=910001)

    def link(self, service_account_id: int | None) -> None:
        SeerWorkflowConfig.objects.filter(id=self.config.id).update(
            service_account_id=service_account_id
        )

    def control_service_account(self, service_account_id: int) -> ServiceAccount:
        with assume_test_silo_mode(SiloMode.CONTROL):
            return ServiceAccount.objects.get(id=service_account_id)

    def test_get_service_account_reads_control(self) -> None:
        assert self.workflow.get_service_account() is None
        with outbox_context(flush=False):
            workflow = SeerWorkflow.create(
                organization_id=self.organization.id,
                strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
                schedule=SeerWorkflowSchedule.DAILY,
                scope=SelectedProjects((self.project.id,)),
                service_account_grant=GRANT,
            )

        account = workflow.get_service_account()

        assert account is not None
        assert account.id == workflow.get_config().service_account_id
        assert account.scope_list == ["event:read"]
        assert not ServiceAccountReplica.objects.filter(service_account_id=account.id).exists()

    def test_set_service_account_grant_commits_with_the_other_changes(self) -> None:
        self.link(self.account.id)
        version = self.workflow.get_config().version
        grant = SeerServiceAccountGrant(scopes=["project:read"], all_projects=True)

        with pytest.raises(WorkflowUpdateError):
            with outbox_runner(), self.workflow.update_config() as update:
                update.set_service_account_grant(grant)
                update.set_enabled(True)
                raise WorkflowUpdateError("failed")

        assert not self.workflow.get_config().enabled
        assert not self.control_service_account(self.account.id).all_projects
        assert not CellOutbox.objects.filter(
            category=OutboxCategory.SERVICE_ACCOUNT_GRANT_UPDATE
        ).exists()

        with outbox_runner(), self.workflow.update_config() as update:
            update.set_service_account_grant(grant)
            update.set_enabled(True)

        config = self.workflow.get_config()
        assert config.enabled
        assert config.version == version + 1
        account = self.control_service_account(self.account.id)
        assert account.scope_list == ["project:read"]
        assert account.all_projects

        with self.workflow.update_config() as update:
            assert not update.set_service_account_grant(grant)
            assert CellOutbox.objects.filter(
                category=OutboxCategory.SERVICE_ACCOUNT_GRANT_UPDATE
            ).exists()
        assert self.workflow.get_config().version == version + 1

    def test_resolution_uses_the_account_id_not_the_replica_id(self) -> None:
        with outbox_runner():
            unrelated = Factories.create_service_account(self.organization, name="unrelated")
        ServiceAccountReplica.objects.filter(service_account_id=unrelated.id).update(
            id=self.account.id
        )
        replica = ServiceAccountReplica.objects.get(service_account_id=self.account.id)
        assert replica.id != self.account.id

        self.link(self.account.id)

        assert self.workflow.resolve_service_account().service_account_id == self.account.id

    def test_resolution_reads_assignment_changes_from_another_instance(self) -> None:
        self.link(self.account.id)
        assert self.workflow.resolve_service_account().service_account_id == self.account.id

        with outbox_runner():
            replacement = Factories.create_service_account(self.organization, name="replacement")
        self.link(replacement.id)
        assert self.workflow.resolve_service_account().service_account_id == replacement.id

        self.link(None)
        with pytest.raises(ValueError, match="no service account"):
            self.workflow.resolve_service_account()

    def test_resolution_waits_for_replication(self) -> None:
        with outbox_context(flush=False):
            pending = Factories.create_service_account(self.organization, name="pending")
        self.link(pending.id)
        with pytest.raises(ValueError, match="unavailable"):
            self.workflow.resolve_service_account()
        with outbox_runner():
            pass
        assert self.workflow.resolve_service_account().service_account_id == pending.id

    def test_resolution_reads_current_replica_state(self) -> None:
        self.link(self.account.id)
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

    def test_resolution_rejects_unset_and_differently_owned_associations(self) -> None:
        with pytest.raises(ValueError, match="no service account"):
            self.workflow.resolve_service_account()
        with outbox_runner():
            foreign = Factories.create_service_account(self.create_organization())
        self.config.update(service_account_id=foreign.id)
        with pytest.raises(ValueError, match="unavailable"):
            self.workflow.resolve_service_account()

    def test_control_deletion_clears_associations_and_resolution_reads_current_config(self) -> None:
        selected = self.create_project()
        Factories.create_seer_workflow_config_project(self.config, selected)
        self.link(self.account.id)
        other = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            service_account_id=self.account.id,
        )
        with outbox_runner():
            unrelated = Factories.create_service_account(self.organization, name="unrelated")
        unrelated_config = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            service_account_id=unrelated.id,
        )
        unrelated_workflow = SeerWorkflow(
            config_id=unrelated_config.id, organization_id=self.organization.id
        )
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
        assert self.config.version == 1
        assert self.workflow.get_project_ids() == [selected.id]
        assert unrelated_workflow.resolve_service_account().service_account_id == unrelated.id
        with pytest.raises(ValueError, match="no service account"):
            self.workflow.resolve_service_account()

    def test_link_during_delayed_account_deletion_is_eventually_cleared(self) -> None:
        account_id = self.account.id
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_context(flush=False):
            self.account.delete()
        self.link(account_id)
        with outbox_runner():
            pass
        with self.tasks():
            schedule_hybrid_cloud_foreign_key_jobs()
        self.config.refresh_from_db()
        assert self.config.service_account_id is None

    def test_missing_replica_does_not_clear_account_identity(self) -> None:
        self.link(self.account.id)
        ServiceAccountReplica.objects.filter(service_account_id=self.account.id).delete()
        with pytest.raises(ValueError, match="unavailable"):
            self.workflow.resolve_service_account()
        self.config.refresh_from_db()
        assert self.config.service_account_id == self.account.id


class SeerWorkflowScheduleSyncTest(TestCase):
    def next_scheduled_for(self, config: SeerWorkflowConfig) -> datetime | None:
        info = get_schedules(
            organization_id=config.organization_id,
            trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
            target_ids=[config.id],
        ).get(config.id)
        return info.next_scheduled_for if info else None

    def set_enabled(self, config: SeerWorkflowConfig, enabled: bool) -> SeerWorkflowConfig:
        workflow = SeerWorkflow(config_id=config.id, organization_id=config.organization_id)
        with workflow.update_config() as update:
            update.set_enabled(enabled)
        return workflow.get_config()

    @freeze_time("2024-03-09 12:00:00")
    def test_enabling_schedules(self) -> None:
        config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        )

        updated = self.set_enabled(config, True)

        assert updated.enabled
        assert updated.version == 2
        assert self.next_scheduled_for(config) == datetime(2024, 3, 10, 10, 0, tzinfo=UTC)

    def test_disabling_unschedules(self) -> None:
        config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        )
        self.set_enabled(config, True)

        updated = self.set_enabled(config, False)

        assert not updated.enabled
        assert updated.version == 3
        assert self.next_scheduled_for(config) is None

    def test_unchanged_does_not_bump_version_but_repairs_schedule(self) -> None:
        config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2, enabled=True
        )

        updated = self.set_enabled(config, True)

        assert updated.version == 1
        assert self.next_scheduled_for(config) is not None

    def test_unscheduled_strategy_is_not_scheduled(self) -> None:
        config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
        )

        self.set_enabled(config, True)

        assert self.next_scheduled_for(config) is None

    def test_delete_unschedules(self) -> None:
        config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        )
        self.set_enabled(config, True)

        SeerWorkflow(config_id=config.id, organization_id=config.organization_id).delete()

        assert self.next_scheduled_for(config) is None
