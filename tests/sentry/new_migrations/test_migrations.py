from django.db import models
from django.db.migrations.state import ModelState

from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction, SentryProjectState


def _state_with_model() -> SentryProjectState:
    state = SentryProjectState()
    state.add_model(ModelState("fakeapp", "Thing", [("id", models.AutoField(primary_key=True))]))
    return state


class MoveToPendingMigration(CheckedMigration):
    operations = [SafeDeleteModel(name="Thing", deletion_action=DeletionAction.MOVE_TO_PENDING)]


def _move_to_pending_migration() -> CheckedMigration:
    return MoveToPendingMigration("0002_move_thing_to_pending", "fakeapp")


def test_mutate_state_does_not_leave_state_rendered() -> None:
    state = _state_with_model()

    new_state = _move_to_pending_migration().mutate_state(state, preserve=False)

    assert "apps" not in new_state.__dict__
    assert ("fakeapp", "thing") in new_state.pending_deletion_models  # type: ignore[attr-defined]
    assert ("fakeapp", "thing") not in new_state.models


def test_mutate_state_keeps_already_rendered_state_rendered() -> None:
    state = _state_with_model()
    state.apps  # render

    new_state = _move_to_pending_migration().mutate_state(state, preserve=True)

    assert "apps" in new_state.__dict__
    assert ("fakeapp", "thing") in new_state.pending_deletion_models  # type: ignore[attr-defined]
