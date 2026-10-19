import pytest
from django.db import IntegrityError, router, transaction
from pydantic import ValidationError

from sentry.seer.models.workflow import (
    SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
    SEER_LEGACY_WORKFLOW_STRATEGIES,
    SeerWorkflowConfig,
    SeerWorkflowConfigExtras,
    SeerWorkflowFilters,
    SeerWorkflowStrategy,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories


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


def test_extras_default_to_no_seeded_default() -> None:
    extras = SeerWorkflowConfigExtras.parse_obj({})

    assert extras.seeded_default is None
    assert extras.dict(exclude_none=True) == {}


def test_extras_read_saved_seeded_default() -> None:
    extras = SeerWorkflowConfigExtras.parse_obj({"seeded_default": "agentic_triage_v2"})

    assert extras.seeded_default == SeerWorkflowStrategy.AGENTIC_TRIAGE_V2


@pytest.mark.parametrize("seeded_default", ["unknown_strategy", 123, {}])
def test_extras_reject_invalid_seeded_default(seeded_default: object) -> None:
    with pytest.raises(ValidationError):
        SeerWorkflowConfigExtras.parse_obj({"seeded_default": seeded_default})


def test_filters_default_to_selected_projects_in_all_environments() -> None:
    filters = SeerWorkflowFilters.parse_obj({})

    assert filters.all_projects is False
    assert filters.environments == []


def test_filters_read_saved_values_and_ignore_unknown_keys() -> None:
    filters = SeerWorkflowFilters.parse_obj(
        {"all_projects": True, "environments": ["production"], "min_event_count": 10}
    )

    assert filters.all_projects is True
    assert filters.environments == ["production"]


@pytest.mark.parametrize("filters", [{"all_projects": "maybe"}, {"environments": "production"}])
def test_filters_reject_wrong_types(filters: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        SeerWorkflowFilters.parse_obj(filters)
