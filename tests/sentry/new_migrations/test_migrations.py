import pytest
from django.core.exceptions import FieldDoesNotExist
from django.db import connection, models
from django.db.migrations import Migration
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.operations.base import Operation
from django.db.migrations.state import ModelState
from django.test import override_settings

from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.fields import SafeRemoveField
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction, SentryProjectState
from sentry.testutils.cases import TestCase


def _state_with_model() -> SentryProjectState:
    state = SentryProjectState()
    state.add_model(
        ModelState(
            "fakeapp",
            "Thing",
            [
                ("id", models.AutoField(primary_key=True)),
                ("flag", models.IntegerField(null=True)),
            ],
        )
    )
    return state


def _migration(*operations: Operation) -> Migration:
    migration_class = type("Migration", (CheckedMigration,), {"operations": list(operations)})
    return migration_class("0002_move_to_pending", "fakeapp")


@pytest.mark.parametrize("preserve", [True, False], ids=["preserve", "in_place"])
@pytest.mark.parametrize("initially_rendered", [True, False], ids=["rendered", "unrendered"])
def test_mutate_state_move_model_to_pending(initially_rendered: bool, preserve: bool) -> None:
    state = _state_with_model()
    if initially_rendered:
        state.apps  # render

    new_state = _migration(
        SafeDeleteModel(name="Thing", deletion_action=DeletionAction.MOVE_TO_PENDING)
    ).mutate_state(state, preserve=preserve)

    # Only a state that was already rendered stays rendered.
    assert ("apps" in new_state.__dict__) is initially_rendered
    if preserve:
        assert new_state is not state
        assert ("fakeapp", "thing") in state.models
        assert state.pending_deletion_models == {}
        assert ("apps" in state.__dict__) is initially_rendered
        if initially_rendered:
            assert state.apps.get_model("fakeapp", "Thing")
    else:
        assert new_state is state

    # The state renders again without the model, and still supplies it for the DELETE step.
    assert ("fakeapp", "thing") not in new_state.models
    with pytest.raises(LookupError):
        new_state.apps.get_model("fakeapp", "Thing")
    pending = new_state.get_pending_deletion_model("fakeapp", "Thing")  # type: ignore[attr-defined]
    assert pending._meta.db_table == "fakeapp_thing"
    assert [f.column for f in pending._meta.fields] == ["id", "flag"]


@pytest.mark.parametrize("preserve", [True, False], ids=["preserve", "in_place"])
@pytest.mark.parametrize("initially_rendered", [True, False], ids=["rendered", "unrendered"])
def test_mutate_state_move_field_to_pending(initially_rendered: bool, preserve: bool) -> None:
    state = _state_with_model()
    if initially_rendered:
        state.apps  # render

    new_state = _migration(
        SafeRemoveField(
            model_name="thing", name="flag", deletion_action=DeletionAction.MOVE_TO_PENDING
        )
    ).mutate_state(state, preserve=preserve)

    # Only a state that was already rendered stays rendered.
    assert ("apps" in new_state.__dict__) is initially_rendered
    if preserve:
        assert new_state is not state
        assert "flag" in state.models["fakeapp", "thing"].fields
        assert state.pending_deletion_fields == {}
        assert ("apps" in state.__dict__) is initially_rendered
        if initially_rendered:
            assert state.apps.get_model("fakeapp", "Thing")._meta.get_field("flag")
    else:
        assert new_state is state

    # The state renders again without the field, and still supplies it for the DELETE step.
    assert "flag" not in new_state.models["fakeapp", "thing"].fields
    with pytest.raises(FieldDoesNotExist):
        new_state.apps.get_model("fakeapp", "Thing")._meta.get_field("flag")
    pending = new_state.get_pending_deletion_field("fakeapp", "thing", "flag")  # type: ignore[attr-defined]
    assert pending.column == "flag"
    assert pending.null
    assert pending.model._meta.db_table == "fakeapp_thing"


def _state_with_m2m_through() -> SentryProjectState:
    state = SentryProjectState()
    state.add_model(ModelState("fakeapp", "Child", [("id", models.AutoField(primary_key=True))]))
    state.add_model(
        ModelState(
            "fakeapp",
            "Parent",
            [
                ("id", models.AutoField(primary_key=True)),
                ("children", models.ManyToManyField("fakeapp.Child", through="fakeapp.Link")),
            ],
        )
    )
    state.add_model(
        ModelState(
            "fakeapp",
            "Link",
            [
                ("id", models.AutoField(primary_key=True)),
                (
                    "parent",
                    models.ForeignKey("fakeapp.Parent", models.CASCADE, db_constraint=False),
                ),
                ("child", models.ForeignKey("fakeapp.Child", models.CASCADE, db_constraint=False)),
            ],
        )
    )
    return state


def test_mutate_state_m2m_through_model_dangles_between_operations() -> None:
    # Mirrors `investigations/0003`: the through model goes to pending before the model that
    # declares the M2M, so between the two operations `Parent.children` points at a model that
    # is no longer in the state. Rendered state may only be dropped at the migration boundary.
    first = SafeDeleteModel(name="Link", deletion_action=DeletionAction.MOVE_TO_PENDING)
    second = SafeDeleteModel(name="Parent", deletion_action=DeletionAction.MOVE_TO_PENDING)

    intermediate = _state_with_m2m_through()
    first.state_forwards("fakeapp", intermediate)
    intermediate.__dict__.pop("apps")
    with pytest.raises(ValueError, match="lazy reference to fakeapp.link"):
        intermediate.apps

    new_state = _migration(first, second).mutate_state(_state_with_m2m_through(), preserve=False)

    assert "apps" not in new_state.__dict__
    assert set(new_state.pending_deletion_models) == {  # type: ignore[attr-defined]
        ("fakeapp", "link"),
        ("fakeapp", "parent"),
    }
    assert new_state.apps.get_model("fakeapp", "Child")


@override_settings(
    INSTALLED_APPS=(
        "fixtures.safe_migrations_apps.executor_state_upstream_app",
        "fixtures.safe_migrations_apps.executor_state_downstream_app",
    ),
    MIGRATION_MODULES={},
)
class ExecutorStateTest(TestCase):
    """
    `TestMigrations` uses the state returned by `executor.migrate(target)` rather than
    `loader.project_state(target)`. The executor state reflects what is applied in the
    database, so it keeps migrations from other apps that stay applied; the graph state only
    includes the target's dependency history.
    """

    upstream = "executor_state_upstream_app"
    downstream = "executor_state_downstream_app"

    def test_executor_state_includes_migrations_applied_in_other_apps(self) -> None:
        executor = MigrationExecutor(connection)
        executor.migrate(
            [(self.upstream, "0002_upstream_later"), (self.downstream, "0002_downstream_later")]
        )

        executor = MigrationExecutor(connection)
        target = (self.downstream, "0001_initial")
        executor_state = executor.migrate([target])
        graph_state = executor.loader.project_state(target)

        # The target app's own state is the same either way.
        for state in (executor_state, graph_state):
            assert (self.downstream, "downstream") in state.models
            assert (self.downstream, "downstreamlater") not in state.models
            assert (self.upstream, "upstream") in state.models

        # Upstream 0002 isn't a dependency of the target but is still applied.
        assert (self.upstream, "upstreamlater") in executor_state.models
        assert (self.upstream, "upstreamlater") not in graph_state.models
        assert executor_state.apps.get_model(self.upstream, "UpstreamLater")
