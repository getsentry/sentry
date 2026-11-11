from collections.abc import Collection, Generator, Sequence
from datetime import timedelta
from unittest.mock import patch

import pytest

from sentry.cadence.models import ScheduledTriggerType
from sentry.cadence.registry import (
    MAX_SPREAD_WINDOW,
    TriggerFiring,
    TriggerHandler,
    TriggerTarget,
    missing_targets,
    register_trigger_type,
    trigger_type_registry,
)
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey
from sentry.testutils.cases import TestCase
from sentry.utils.registry import AlreadyRegisteredError

SEER_WORKFLOW = ScheduledTriggerType.SEER_WORKFLOW


@pytest.fixture
def empty_registry() -> Generator[None]:
    with patch.dict(trigger_type_registry.registrations, clear=True):
        yield


class Handler(TriggerHandler):
    def dispatch(self, firings: Sequence[TriggerFiring]) -> None:
        pass

    def find_missing(self, targets: Sequence[TriggerTarget]) -> Collection[TriggerTarget]:
        return ()


@pytest.mark.usefixtures("empty_registry")
class TestRegisterTriggerType:
    def test_registers_an_instance(self) -> None:
        assert register_trigger_type(SEER_WORKFLOW)(Handler) is Handler

        handler = trigger_type_registry.get(SEER_WORKFLOW)
        assert isinstance(handler, Handler)
        assert handler.spread_window == timedelta(0)

    def test_registers_spread_window(self) -> None:
        @register_trigger_type(SEER_WORKFLOW)
        class Spread(Handler):
            spread_window = MAX_SPREAD_WINDOW

        assert trigger_type_registry.get(SEER_WORKFLOW).spread_window == MAX_SPREAD_WINDOW

    @pytest.mark.parametrize(
        "spread_window",
        [
            timedelta(seconds=-1),
            MAX_SPREAD_WINDOW + timedelta(seconds=1),
            timedelta(minutes=1, microseconds=1),
        ],
    )
    def test_rejects_invalid_spread_window(self, spread_window: timedelta) -> None:
        class Invalid(Handler):
            pass

        Invalid.spread_window = spread_window

        with pytest.raises(ValueError):
            register_trigger_type(SEER_WORKFLOW)(Invalid)
        assert SEER_WORKFLOW not in trigger_type_registry.registrations

    def test_requires_find_missing(self) -> None:
        class NoFindMissing(TriggerHandler):
            def dispatch(self, firings: Sequence[TriggerFiring]) -> None:
                pass

        with pytest.raises(TypeError):
            register_trigger_type(SEER_WORKFLOW)(NoFindMissing)

    def test_requires_dispatch(self) -> None:
        class NoDispatch(TriggerHandler):
            def find_missing(self, targets: Sequence[TriggerTarget]) -> Collection[TriggerTarget]:
                return ()

        with pytest.raises(TypeError):
            register_trigger_type(SEER_WORKFLOW)(NoDispatch)

    def test_rejects_duplicate_registration(self) -> None:
        register_trigger_type(SEER_WORKFLOW)(Handler)

        with pytest.raises(AlreadyRegisteredError):
            register_trigger_type(SEER_WORKFLOW)(Handler)


class MissingTargetsTest(TestCase):
    def test_reports_deleted_and_other_organizations_targets(self) -> None:
        other_org = self.create_organization()
        existing = TriggerTarget(organization_id=self.organization.id, target_id=self.project.id)
        deleted = TriggerTarget(
            organization_id=self.organization.id, target_id=self.project.id + 1000
        )
        wrong_org = TriggerTarget(organization_id=other_org.id, target_id=self.project.id)

        assert missing_targets(Project, [existing, deleted, wrong_org]) == [deleted, wrong_org]

    def test_org_field(self) -> None:
        key = self.create_project_key(project=self.project)
        other_org = self.create_organization()
        existing = TriggerTarget(organization_id=self.organization.id, target_id=key.id)
        wrong_org = TriggerTarget(organization_id=other_org.id, target_id=key.id)

        assert missing_targets(
            ProjectKey, [existing, wrong_org], org_field="project__organization_id"
        ) == [wrong_org]

    def test_empty(self) -> None:
        with self.assertNumQueries(0):
            assert missing_targets(Project, []) == []
