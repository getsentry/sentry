from django.db import connection, models

from sentry.new_migrations.utils import drop_column_indexes
from sentry.testutils import TestCase


class IndexedModel(models.Model):
    col_a = models.IntegerField()
    col_b = models.IntegerField()
    col_c = models.IntegerField()

    class Meta:
        managed = False
        db_table = "IndexedModel"


class DropColumnIndexesTest(TestCase):
    def test(self):
        indexes = (
            ("index_1", ("col_a", "col_b")),
            ("index_2", ("col_a", "col_c")),
            ("index_3", ("col_a", "col_b", "col_c")),
            ("index_4", ("col_a", "col_b", "col_c")),
        )
        with connection.schema_editor() as schema_editor:
            schema_editor.create_model(IndexedModel)
            for index_name, cols in indexes:
                schema_editor.execute(
                    schema_editor.sql_create_index
                    % {
                        "table": schema_editor.quote_name(IndexedModel._meta.db_table),
                        "name": schema_editor.quote_name(index_name),
                        "columns": ", ".join(schema_editor.quote_name(col) for col in cols),
                        "using": "",
                        "extra": "",
                    }
                )
            schema_editor.execute(
                f"CREATE INDEX partial ON {schema_editor.quote_name(IndexedModel._meta.db_table)} (col_a, col_b) WHERE col_a = 1"
            )

            assert set(schema_editor._constraint_names(IndexedModel, index=True)) == {
                "partial",
                "index_1",
                "index_2",
                "index_3",
                "index_4",
            }

            # Shouldn't drop anything, since even though this column is part of the
            # indexes it's not the entire index.
            drop_column_indexes(schema_editor, IndexedModel, ["col_a"], False)
            assert set(schema_editor._constraint_names(IndexedModel, index=True)) == {
                "partial",
                "index_1",
                "index_2",
                "index_3",
                "index_4",
            }

            drop_column_indexes(schema_editor, IndexedModel, ["col_a", "col_b"], False)
            assert set(schema_editor._constraint_names(IndexedModel, index=True)) == {
                "index_2",
                "index_3",
                "index_4",
            }

            drop_column_indexes(schema_editor, IndexedModel, ["col_a", "col_b", "col_c"], False)

            assert set(schema_editor._constraint_names(IndexedModel, index=True)) == {"index_2"}
