from django.db import models
from django.db.migrations.operations import (
    AddField,
    AlterModelOptions,
    CreateModel,
    DeleteModel,
    RemoveField,
)
from django.db.migrations.operations.base import Operation
from django.db.migrations.optimizer import MigrationOptimizer
from django.db.migrations.writer import OperationWriter

from sentry.new_migrations.monkey.fields import SafeRemoveField
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction, SentryProjectState
from sentry.testutils.cases import TestCase


class SafeOpSerializationTest(TestCase):
    def test_safe_remove_field_round_trips_all_args(self) -> None:
        op = SafeRemoveField(
            model_name="testtable",
            name="field",
            deletion_action=DeletionAction.MOVE_TO_PENDING,
        )
        rendered, imports = OperationWriter(op).serialize()

        assert "model_name='testtable'" in rendered
        assert "name='field'" in rendered
        assert "deletion_action=" in rendered
        assert "MOVE_TO_PENDING" in rendered
        assert "import sentry.new_migrations.monkey.fields" in imports

    def test_safe_delete_model_round_trips_all_args(self) -> None:
        op = SafeDeleteModel(
            name="TestTable",
            deletion_action=DeletionAction.MOVE_TO_PENDING,
        )
        rendered, imports = OperationWriter(op).serialize()

        assert "name='TestTable'" in rendered
        assert "deletion_action=" in rendered
        assert "MOVE_TO_PENDING" in rendered
        assert "import sentry.new_migrations.monkey.models" in imports


class SafeOpOptimizerTest(TestCase):
    def test_add_then_safe_remove_field_pair_survives(self) -> None:
        ops: list[Operation] = [
            AddField(model_name="testtable", name="field", field=models.IntegerField(null=True)),
            SafeRemoveField(
                model_name="testtable",
                name="field",
                deletion_action=DeletionAction.MOVE_TO_PENDING,
            ),
        ]

        optimized = MigrationOptimizer().optimize(ops, "testapp")

        assert [type(op).__name__ for op in optimized] == ["AddField", "SafeRemoveField"]

    def test_create_then_safe_delete_model_pair_survives(self) -> None:
        ops: list[Operation] = [
            CreateModel(name="TestTable", fields=[]),
            SafeDeleteModel(name="TestTable", deletion_action=DeletionAction.MOVE_TO_PENDING),
        ]

        optimized = MigrationOptimizer().optimize(ops, "testapp")

        assert [type(op).__name__ for op in optimized] == ["CreateModel", "SafeDeleteModel"]

    def test_plain_add_then_remove_field_still_optimizes_away(self) -> None:
        ops: list[Operation] = [
            AddField(model_name="testtable", name="field", field=models.IntegerField(null=True)),
            RemoveField(model_name="testtable", name="field"),
        ]

        assert MigrationOptimizer().optimize(ops, "testapp") == []

    def test_plain_create_then_delete_model_still_optimizes_away(self) -> None:
        ops: list[Operation] = [
            CreateModel(name="TestTable", fields=[]),
            DeleteModel(name="TestTable"),
        ]

        assert MigrationOptimizer().optimize(ops, "testapp") == []

    def test_delete_action_pair_still_optimizes_away(self) -> None:
        ops: list[Operation] = [
            CreateModel(name="TestTable", fields=[]),
            SafeDeleteModel(name="TestTable", deletion_action=DeletionAction.DELETE),
        ]

        assert MigrationOptimizer().optimize(ops, "testapp") == []

    def test_full_baked_model_and_field_sequence_survives(self) -> None:
        ops = _baked_model_and_field_ops()

        optimized = MigrationOptimizer().optimize(ops, "testapp")

        # AddField legitimately folds into CreateModel, but neither pending op
        # may be annihilated
        assert [type(op).__name__ for op in optimized] == [
            "CreateModel",
            "SafeRemoveField",
            "SafeDeleteModel",
        ]
        create, remove, delete = optimized
        assert isinstance(create, CreateModel)
        assert isinstance(remove, SafeRemoveField)
        assert isinstance(delete, SafeDeleteModel)
        assert [name for name, _ in create.fields] == ["id", "x"]
        assert remove.deletion_action == DeletionAction.MOVE_TO_PENDING
        assert delete.deletion_action == DeletionAction.MOVE_TO_PENDING

    def test_optimized_baked_sequence_repopulates_both_registries(self) -> None:
        optimized = MigrationOptimizer().optimize(_baked_model_and_field_ops(), "testapp")

        state = SentryProjectState()
        for op in optimized:
            op.state_forwards("testapp", state)

        assert ("testapp", "foo", "x") in state.pending_deletion_fields
        assert ("testapp", "foo") in state.pending_deletion_models

    def test_unrelated_pending_op_matches_unpatched_behavior(self) -> None:
        def build(remove: Operation) -> list[Operation]:
            return [
                CreateModel(name="Foo", fields=[("id", models.AutoField(primary_key=True))]),
                remove,
                AlterModelOptions(name="bar", options={"verbose_name": "b"}),
                AddField(
                    model_name="foo",
                    name="a",
                    field=models.ForeignKey("testapp.Bar", on_delete=models.CASCADE, null=True),
                ),
            ]

        patched = MigrationOptimizer().optimize(
            build(
                SafeRemoveField(
                    model_name="bar", name="z", deletion_action=DeletionAction.MOVE_TO_PENDING
                )
            ),
            "testapp",
        )
        baseline = MigrationOptimizer().optimize(
            build(RemoveField(model_name="bar", name="z")), "testapp"
        )

        # a pending op on an unrelated model must not de-optimize the rest
        assert [type(op).__name__ for op in patched] == [
            "SafeRemoveField",
            "AlterModelOptions",
            "CreateModel",
        ]
        assert [type(op).__name__ for op in baseline] == [
            "RemoveField",
            "AlterModelOptions",
            "CreateModel",
        ]


def _baked_model_and_field_ops() -> list[Operation]:
    return [
        CreateModel(name="Foo", fields=[("id", models.AutoField(primary_key=True))]),
        AddField(model_name="foo", name="x", field=models.IntegerField(null=True)),
        SafeRemoveField(
            model_name="foo",
            name="x",
            deletion_action=DeletionAction.MOVE_TO_PENDING,
        ),
        SafeDeleteModel(name="Foo", deletion_action=DeletionAction.MOVE_TO_PENDING),
    ]
