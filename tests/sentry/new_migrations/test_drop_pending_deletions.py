from typing import Any

from django.db import connection, models
from django.db.migrations.state import ModelState

from sentry.new_migrations.monkey.fields import SafeRemoveField
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction, SentryProjectState
from sentry.testutils.cases import TestCase
from tools.migrations.drop_pending_deletions import pending_deletion_sql

APP = "drift_test"


def _model(name: str, *fields: tuple[str, models.Field[Any, Any]]) -> ModelState:
    return ModelState(APP, name, [("id", models.BigAutoField(primary_key=True)), *fields])


class PendingDeletionSqlTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.state = SentryProjectState()
        for model_state in (
            _model("Tag"),
            _model(
                "Thing",
                ("kept", models.IntegerField(null=True)),
                ("old", models.IntegerField(null=True)),
                ("tags", models.ManyToManyField(f"{APP}.Tag")),
                (
                    "members",
                    models.ManyToManyField(
                        f"{APP}.Tag",
                        through=f"{APP}.Membership",
                        related_name="+",
                    ),
                ),
            ),
            _model(
                "Membership",
                ("thing", models.ForeignKey(f"{APP}.Thing", models.CASCADE, db_constraint=False)),
                ("tag", models.ForeignKey(f"{APP}.Tag", models.CASCADE, db_constraint=False)),
            ),
            _model("Gone", ("tags", models.ManyToManyField(f"{APP}.Tag", related_name="+"))),
            _model("Unrelated", ("value", models.IntegerField())),
        ):
            self.state.add_model(model_state)

        with connection.schema_editor() as editor:
            for model in self.state.apps.get_models():
                editor.create_model(model)

        for operation in (
            SafeRemoveField("thing", "old", deletion_action=DeletionAction.MOVE_TO_PENDING),
            SafeRemoveField("thing", "tags", deletion_action=DeletionAction.MOVE_TO_PENDING),
            SafeRemoveField("thing", "members", deletion_action=DeletionAction.MOVE_TO_PENDING),
            SafeDeleteModel("Gone", deletion_action=DeletionAction.MOVE_TO_PENDING),
        ):
            operation.state_forwards(APP, self.state)

    def _drop(self) -> list[str]:
        statements = pending_deletion_sql(self.state, connection)
        with connection.cursor() as cursor:
            for statement in statements:
                cursor.execute(statement)
        return statements

    def _tables(self) -> set[str]:
        with connection.cursor() as cursor:
            return {t for t in connection.introspection.table_names(cursor) if t.startswith(APP)}

    def _columns(self, table: str) -> set[str]:
        with connection.cursor() as cursor:
            return {c.name for c in connection.introspection.get_table_description(cursor, table)}

    def test_sql(self) -> None:
        assert self._drop() == [
            'ALTER TABLE "drift_test_thing" DROP COLUMN "old"',
            'DROP TABLE "drift_test_thing_tags"',
            'DROP TABLE "drift_test_gone_tags"',
            'DROP TABLE "drift_test_gone"',
        ]

    def test_scalar_field(self) -> None:
        assert "old" in self._columns("drift_test_thing")
        self._drop()
        assert self._columns("drift_test_thing") == {"id", "kept"}

    def test_m2m_field(self) -> None:
        self._drop()
        tables = self._tables()
        # The auto-created through table goes with its field...
        assert "drift_test_thing_tags" not in tables
        # ...but an explicit through model isn't the field's to drop.
        assert "drift_test_membership" in tables
        assert self._columns("drift_test_membership") == {"id", "thing_id", "tag_id"}

    def test_model(self) -> None:
        assert {"drift_test_gone", "drift_test_gone_tags"} <= self._tables()
        self._drop()
        assert not {"drift_test_gone", "drift_test_gone_tags"} & self._tables()

    def test_unrelated_schema_is_kept(self) -> None:
        self._drop()
        assert self._tables() == {
            "drift_test_tag",
            "drift_test_thing",
            "drift_test_membership",
            "drift_test_unrelated",
        }
        assert self._columns("drift_test_unrelated") == {"id", "value"}
