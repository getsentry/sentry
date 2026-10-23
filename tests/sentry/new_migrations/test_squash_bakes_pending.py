import ast
import textwrap
from typing import Any

from django.db.migrations.loader import MigrationLoader
from django.test import override_settings

from sentry.management.commands.bake_pending_deletions import AppInjection, build_injection_payload
from sentry.new_migrations.monkey.state import DeletionAction, SentryProjectState
from sentry.testutils.cases import TestCase
from tools.migrations.squash import inject_pending_deletions

APP = "pending_field_not_deleted_app"
BASE = "fixtures.safe_migrations_apps"


def eval_ops(payload: AppInjection) -> list[Any]:
    ns: dict[str, Any] = {}
    exec("from django.db import migrations, models", ns)
    exec("import sentry.new_migrations.monkey.fields", ns)
    exec("import sentry.new_migrations.monkey.models", ns)
    exec("import sentry.new_migrations.monkey.state", ns)
    for imp in payload["imports"]:
        exec(imp, ns)
    return [eval(textwrap.dedent(text).strip().rstrip(","), ns) for text in payload["operations"]]


SQUASH_WITHOUT_PENDING = """\
from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    is_post_deployment = False

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="TestTable",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
            ],
        ),
    ]
"""


class SquashBakesPendingTest(TestCase):
    def _payload(self) -> dict[str, AppInjection]:
        with override_settings(INSTALLED_APPS=(f"{BASE}.{APP}",), MIGRATION_MODULES={}):
            loader = MigrationLoader(None, ignore_no_migrations=True)
            state = loader.project_state(nodes=None, at_end=True)
            return build_injection_payload(state, squashed_apps={APP})

    def test_pending_field_is_captured_for_bake(self) -> None:
        payload = self._payload()

        assert APP in payload
        ops = "\n".join(payload[APP]["operations"])
        assert "AddField(" in ops
        assert "SafeRemoveField(" in ops
        assert "MOVE_TO_PENDING" in ops

    def test_injected_squash_re_pends_the_column(self) -> None:
        payload = self._payload()[APP]

        out = "".join(
            inject_pending_deletions(SQUASH_WITHOUT_PENDING.splitlines(keepends=True), payload)
        )

        ast.parse(out)
        assert "name='field'" in out
        assert "MOVE_TO_PENDING" in out
        assert out.index("AddField(") < out.index("SafeRemoveField(")


class PendingModelAndFieldReplayTest(TestCase):
    def _pending_both(self) -> tuple[SentryProjectState, AppInjection]:
        with override_settings(INSTALLED_APPS=(f"{BASE}.{APP}",), MIGRATION_MODULES={}):
            loader = MigrationLoader(None, ignore_no_migrations=True)
            state = loader.project_state(nodes=None, at_end=True)
            assert isinstance(state, SentryProjectState)
            assert (APP, "testtable", "field") in state.pending_deletion_fields
            state.remove_model(APP, "testtable", deletion_action=DeletionAction.MOVE_TO_PENDING)
            assert (APP, "testtable") in state.pending_deletion_models
            return state, build_injection_payload(state, squashed_apps={APP})[APP]

    def test_emitted_ops_replay_without_error(self) -> None:
        _, payload = self._pending_both()
        ops = eval_ops(payload)

        replayed = SentryProjectState()
        for op in ops:
            op.state_forwards(APP, replayed)

        assert (APP, "testtable", "field") in replayed.pending_deletion_fields
        assert (APP, "testtable") in replayed.pending_deletion_models

    def test_field_still_live_in_state_emits_nothing(self) -> None:
        with override_settings(INSTALLED_APPS=(f"{BASE}.{APP}",), MIGRATION_MODULES={}):
            loader = MigrationLoader(None, ignore_no_migrations=True)
            # state at 0001: the field is still live, but the registry also lists it.
            # re-adding it would duplicate the column the squash's CreateModel makes.
            state = loader.project_state(nodes=[(APP, "0001_initial")], at_end=True)
            assert isinstance(state, SentryProjectState)
            assert "field" in state.models[(APP, "testtable")].fields
            state.pending_deletion_fields[(APP, "testtable", "field")] = state.models[
                (APP, "testtable")
            ].fields["field"]

            payload = build_injection_payload(state, squashed_apps={APP})

        assert payload == {}, payload

    def test_emission_order_is_create_add_remove_delete(self) -> None:
        _, payload = self._pending_both()
        kinds = [type(op).__name__ for op in eval_ops(payload)]

        assert kinds == ["CreateModel", "AddField", "SafeRemoveField", "SafeDeleteModel"], kinds


class CyclicPendingModelsTest(TestCase):
    APP = "bake_cyclic_pending_models_app"

    def _payload(self) -> AppInjection:
        with override_settings(INSTALLED_APPS=(f"{BASE}.{self.APP}",), MIGRATION_MODULES={}):
            loader = MigrationLoader(None, ignore_no_migrations=True)
            state = loader.project_state(nodes=None, at_end=True)
            assert isinstance(state, SentryProjectState)
            assert (self.APP, "cell") in state.pending_deletion_models
            assert (self.APP, "execution") in state.pending_deletion_models
            return build_injection_payload(state, squashed_apps={self.APP})[self.APP]

    def test_mutual_fks_are_deferred_out_of_create_models(self) -> None:
        # Cell and Execution reference each other; no CreateModel order can resolve an
        # inline FK to the not-yet-created peer. The mutual FKs must be emitted as
        # AddField after both tables exist, mirroring Django's own circular handling.
        payload = self._payload()
        ops = eval_ops(payload)
        kinds = [type(op).__name__ for op in ops]

        creates = [op for op in ops if type(op).__name__ == "CreateModel"]
        for op in creates:
            for _name, field in op.fields:
                assert field.remote_field is None, f"{op.name} still carries an inline FK"

        last_create = max(i for i, k in enumerate(kinds) if k == "CreateModel")
        first_addfield = min(i for i, k in enumerate(kinds) if k == "AddField")
        assert last_create < first_addfield, kinds
        added = {op.name for op in ops if type(op).__name__ == "AddField"}
        assert {"execution", "cell"} <= added, added

    def test_m2m_through_a_pending_model_is_deferred(self) -> None:
        # Execution.linked_cells goes through the pending `Link` model. Django's
        # create_model reads through._meta, which is an unresolved string mid-migration,
        # so the m2m must be held back to an AddField after Link's table exists.
        payload = self._payload()
        ops = eval_ops(payload)

        for op in ops:
            if type(op).__name__ == "CreateModel":
                assert not any(
                    getattr(field, "many_to_many", False) for _name, field in op.fields
                ), f"{op.name} still carries an inline m2m"
        added = [op.name for op in ops if type(op).__name__ == "AddField"]
        assert "linked_cells" in added, added

    def test_index_and_constraint_on_deferred_fk_are_re_emitted(self) -> None:
        # Execution's index and unique constraint reference the deferred `cell` FK, so
        # they cannot sit in the CreateModel. They are stripped out and re-emitted as
        # AddIndex / AddConstraint after the FK is added back — the same shape Django's
        # own initial migration for these models produces.
        payload = self._payload()
        ops = eval_ops(payload)
        kinds = [type(op).__name__ for op in ops]

        exec_create = next(
            op for op in ops if type(op).__name__ == "CreateModel" and op.name == "Execution"
        )
        assert not exec_create.options.get("indexes")
        assert not exec_create.options.get("constraints")

        assert kinds.count("AddIndex") == 1, kinds
        assert kinds.count("AddConstraint") == 1, kinds
        last_addfield = max(i for i, k in enumerate(kinds) if k == "AddField")
        first_reemit = min(i for i, k in enumerate(kinds) if k in ("AddIndex", "AddConstraint"))
        assert last_addfield < first_reemit, kinds
