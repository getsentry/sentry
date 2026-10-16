from collections.abc import Sequence

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, router, transaction

from sentry.constants import ObjectStatus
from sentry.models.environment import Environment
from sentry.seer.models.workflow import (
    SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
    SEER_LEGACY_WORKFLOW_STRATEGIES,
    SeerWorkflowConfig,
    SeerWorkflowConfigProject,
    SeerWorkflowSelection,
    SeerWorkflowStrategy,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories

V2 = SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
ALL = SeerWorkflowSelection.ALL


class SeerWorkflowConfigTest(TestCase):
    def test_every_strategy_is_legacy_or_configurable(self) -> None:
        assert SEER_LEGACY_WORKFLOW_STRATEGIES | SEER_CONFIGURABLE_WORKFLOW_STRATEGIES == set(
            SeerWorkflowStrategy
        )
        assert not SEER_LEGACY_WORKFLOW_STRATEGIES & SEER_CONFIGURABLE_WORKFLOW_STRATEGIES

    def test_get_or_create_for_strategy_rejects_configurable_strategy(self) -> None:
        with pytest.raises(ValueError):
            SeerWorkflowConfig.get_or_create_for_strategy(
                self.organization.id,
                SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            )

        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()

    def test_legacy_strategy_has_one_config_per_organization_and_v2_has_many(self) -> None:
        legacy = SeerWorkflowConfig.get_or_create_for_strategy(
            self.organization.id, SeerWorkflowStrategy.AGENTIC_TRIAGE
        )
        assert legacy == SeerWorkflowConfig.get_or_create_for_strategy(
            self.organization.id, SeerWorkflowStrategy.AGENTIC_TRIAGE
        )
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(router.db_for_write(SeerWorkflowConfig)),
        ):
            Factories.create_seer_workflow_config(
                self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE
            )

        v2_configs = [
            Factories.create_seer_workflow_config(
                self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
            )
            for _ in range(2)
        ]

        assert v2_configs[0] != v2_configs[1]
        assert (
            SeerWorkflowConfig.get_or_create_for_strategy(
                self.organization.id, SeerWorkflowStrategy.AGENTIC_TRIAGE
            )
            == legacy
        )


class SeerWorkflowConfigScopeTest(TestCase):
    def reload(self, config: SeerWorkflowConfig) -> SeerWorkflowConfig:
        return SeerWorkflowConfig.objects.get(id=config.id)

    def create_selected(
        self, *project_ids: int, environments: SeerWorkflowSelection | Sequence[str] = ALL
    ) -> SeerWorkflowConfig:
        return SeerWorkflowConfig.create_configurable(
            self.organization.id, V2, projects=project_ids, environments=environments
        )

    def create_all(
        self, environments: SeerWorkflowSelection | Sequence[str] = ALL
    ) -> SeerWorkflowConfig:
        return SeerWorkflowConfig.create_configurable(
            self.organization.id, V2, projects=ALL, environments=environments
        )

    def test_create_selected_projects_covers_exactly_those_projects(self) -> None:
        selected = [self.create_project(), self.create_project()]
        self.create_project()

        config = self.create_selected(*(p.id for p in selected), environments=["production"])

        saved = self.reload(config)
        assert saved.get_project_ids() == sorted(p.id for p in selected)
        assert saved.is_all_projects is False
        assert saved.version == 1
        assert saved.environments == ["production"]
        assert saved.strategy == V2

    def test_configs_in_one_organization_are_independent(self) -> None:
        a, b, c = self.create_project(), self.create_project(), self.create_project()
        first = self.create_selected(a.id, environments=["production"])
        second = self.create_selected(b.id, environments=["staging"])

        second.set_scope(projects=[c.id], environments=ALL)

        assert self.reload(first).get_project_ids() == [a.id]
        assert self.reload(first).environments == ["production"]
        assert self.reload(first).version == 1
        assert self.reload(second).get_project_ids() == [c.id]
        assert self.reload(second).environments == []
        assert self.reload(second).version == 2

    def test_create_rejects_legacy_strategies(self) -> None:
        project = self.create_project()

        for strategy in SEER_LEGACY_WORKFLOW_STRATEGIES:
            with pytest.raises(ValueError):
                SeerWorkflowConfig.create_configurable(
                    self.organization.id,
                    strategy,
                    projects=[project.id],
                    environments=ALL,
                )

        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()

    def test_set_scope_rejects_legacy_configs(self) -> None:
        project = self.create_project()

        for strategy in SEER_LEGACY_WORKFLOW_STRATEGIES:
            legacy = SeerWorkflowConfig.get_or_create_for_strategy(
                self.organization.id,
                strategy,
            )

            with pytest.raises(ValueError):
                legacy.set_scope(projects=[project.id], environments=ALL)

            saved = self.reload(legacy)
            assert saved.version == 1
            assert saved.get_project_ids() == []

    def test_projects_and_environments_cannot_be_omitted(self) -> None:
        project = self.create_project()
        config = self.create_selected(project.id)

        with pytest.raises(TypeError):
            SeerWorkflowConfig.create_configurable(  # type: ignore[call-arg]
                self.organization.id, V2, projects=[project.id]
            )
        with pytest.raises(TypeError):
            SeerWorkflowConfig.create_configurable(  # type: ignore[call-arg]
                self.organization.id, V2, environments=ALL
            )
        with pytest.raises(TypeError):
            config.set_scope(projects=ALL)  # type: ignore[call-arg]
        with pytest.raises(TypeError):
            config.set_scope(environments=ALL)  # type: ignore[call-arg]

    def test_selected_projects_cannot_be_empty(self) -> None:
        with pytest.raises(ValidationError) as create_error:
            self.create_selected()

        assert set(create_error.value.message_dict) == {"projects"}
        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()

        project = self.create_project()
        config = self.create_selected(project.id)
        with pytest.raises(ValidationError) as set_error:
            config.set_scope(projects=[], environments=ALL)

        assert set(set_error.value.message_dict) == {"projects"}
        assert self.reload(config).get_project_ids() == [project.id]

    def test_other_organization_and_inactive_projects_are_rejected_alike(self) -> None:
        other_project = self.create_project(organization=self.create_organization())
        pending_deletion = self.create_project()
        pending_deletion.update(status=ObjectStatus.PENDING_DELETION)
        missing_id = other_project.id + 1000

        messages = []
        for project_id in (other_project.id, pending_deletion.id, missing_id):
            with pytest.raises(ValidationError) as error:
                self.create_selected(project_id)
            assert set(error.value.message_dict) == {"projects"}
            messages.append(error.value.message_dict["projects"])

        assert messages == [
            [f"Invalid project ids: {project_id}."]
            for project_id in (other_project.id, pending_deletion.id, missing_id)
        ]
        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()
        assert not SeerWorkflowConfigProject.objects.exists()

    def test_one_invalid_project_rejects_the_whole_selection(self) -> None:
        valid = self.create_project()
        other_project = self.create_project(organization=self.create_organization())

        with pytest.raises(ValidationError):
            self.create_selected(valid.id, other_project.id)

        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()
        assert not SeerWorkflowConfigProject.objects.exists()

    def test_all_projects_covers_projects_created_later(self) -> None:
        first = self.create_project()

        config = self.create_all()
        later = self.create_project()
        other_organization_project = self.create_project(organization=self.create_organization())

        assert config.get_project_ids() == [first.id, later.id]
        assert other_organization_project.id not in config.get_project_ids()
        assert not SeerWorkflowConfigProject.objects.filter(config=config).exists()

    def test_all_projects_skips_inactive_projects(self) -> None:
        active = self.create_project()
        pending_deletion = self.create_project()
        pending_deletion.update(status=ObjectStatus.PENDING_DELETION)

        assert self.create_all().get_project_ids() == [active.id]

    def test_all_projects_in_organization_without_active_projects_is_empty(self) -> None:
        config = self.create_all()

        assert config.get_project_ids() == []
        assert config.is_all_projects is True

    def test_switching_between_all_and_selected_projects(self) -> None:
        a, b, c = self.create_project(), self.create_project(), self.create_project()
        config = self.create_selected(a.id, b.id)

        config.set_scope(projects=ALL, environments=ALL)

        assert config.version == 2
        assert self.reload(config).version == 2
        assert self.reload(config).is_all_projects is True
        assert self.reload(config).get_project_ids() == [a.id, b.id, c.id]
        assert not SeerWorkflowConfigProject.objects.filter(config=config).exists()

        config.set_scope(projects=[b.id, c.id], environments=ALL)

        assert config.version == 3
        assert self.reload(config).version == 3
        assert self.reload(config).is_all_projects is False
        assert self.reload(config).get_project_ids() == [b.id, c.id]

        config.set_scope(projects=[a.id], environments=ALL)

        assert self.reload(config).get_project_ids() == [a.id]
        assert self.reload(config).version == 4

    def test_rejected_set_scope_changes_nothing(self) -> None:
        project = self.create_project()
        other_project = self.create_project(organization=self.create_organization())
        config = self.create_selected(project.id, environments=["production"])

        with pytest.raises(ValidationError):
            config.set_scope(projects=[project.id, other_project.id], environments=["staging"])
        with pytest.raises(ValidationError):
            config.set_scope(projects=ALL, environments=["staging/eu"])

        for current in (config, self.reload(config)):
            assert current.is_all_projects is False
            assert current.get_project_ids() == [project.id]
            assert current.environments == ["production"]
            assert current.version == 1

    def test_invalid_environment_names_are_rejected(self) -> None:
        project = self.create_project()

        with pytest.raises(ValidationError) as create_error:
            self.create_selected(project.id, environments=["production", "staging/eu"])

        assert set(create_error.value.message_dict) == {"environments"}
        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()

        config = self.create_selected(project.id, environments=["production"])
        with pytest.raises(ValidationError) as set_error:
            config.set_scope(projects=[project.id], environments=["a" * 65])

        assert set(set_error.value.message_dict) == {"environments"}
        assert self.reload(config).environments == ["production"]

    def test_project_and_environment_errors_are_reported_together(self) -> None:
        with pytest.raises(ValidationError) as error:
            self.create_selected(environments=["staging/eu"])

        assert set(error.value.message_dict) == {"projects", "environments"}

    def test_environment_names_are_deduplicated_exactly_in_first_seen_order(self) -> None:
        project = self.create_project()

        config = self.create_selected(
            project.id, environments=["production", "production", "Production"]
        )

        assert self.reload(config).environments == ["production", "Production"]

        config.set_scope(projects=[project.id], environments=["staging", "production", "staging"])

        assert self.reload(config).environments == ["staging", "production"]

    def test_environment_names_are_kept_as_saved(self) -> None:
        project = self.create_project()

        config = self.create_selected(project.id, environments=["deleted-environment"])

        assert not Environment.objects.filter(name="deleted-environment").exists()
        assert self.reload(config).environments == ["deleted-environment"]

    def test_all_environments_stores_an_empty_list(self) -> None:
        project = self.create_project()
        config = self.create_selected(project.id, environments=["production"])

        config.set_scope(projects=[project.id], environments=ALL)

        assert config.environments == []
        assert self.reload(config).environments == []
        assert self.create_all(environments=ALL).environments == []

    def test_selected_environments_cannot_be_empty(self) -> None:
        project = self.create_project()

        with pytest.raises(ValidationError) as create_error:
            self.create_selected(project.id, environments=[])

        assert create_error.value.message_dict == {
            "environments": ["Select at least one environment."]
        }
        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()

        config = self.create_selected(project.id, environments=["production"])
        with pytest.raises(ValidationError) as set_error:
            config.set_scope(projects=[project.id], environments=[])

        assert set(set_error.value.message_dict) == {"environments"}
        assert self.reload(config).environments == ["production"]
        assert self.reload(config).version == 1

    def test_environments_reject_a_single_string(self) -> None:
        project = self.create_project()

        with pytest.raises(TypeError):
            self.create_selected(project.id, environments="production")

        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()

    def test_deleting_every_selected_project_does_not_widen_to_all(self) -> None:
        selected = [self.create_project(), self.create_project()]
        self.create_project()
        config = self.create_selected(*(p.id for p in selected))

        for project in selected:
            project.update(status=ObjectStatus.PENDING_DELETION)

        assert self.reload(config).get_project_ids() == []
        assert self.reload(config).is_all_projects is False

    def test_deleting_one_selected_project_keeps_the_rest(self) -> None:
        a, b, c = self.create_project(), self.create_project(), self.create_project()
        config = self.create_selected(a.id, b.id, c.id)

        a.update(status=ObjectStatus.PENDING_DELETION)
        assert config.get_project_ids() == [b.id, c.id]

        b.delete()
        assert config.get_project_ids() == [c.id]

    def test_deleting_every_selected_project_for_real_does_not_widen_to_all(self) -> None:
        selected = [self.create_project(), self.create_project()]
        self.create_project()
        config = self.create_selected(*(p.id for p in selected))

        for project in selected:
            project.delete()

        assert self.reload(config).get_project_ids() == []
        assert self.reload(config).is_all_projects is False
