from __future__ import absolute_import

from django.db import migrations


class ConcurrentAlterUniqueTogether(migrations.AlterUniqueTogether):
    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        """
        Note: This is copied out of
        django.db.migrations.operations.models.AlterUniqueTogether.database_forwards
        and modified. We'll need to make sure this keeps working after Django upgrades.
        """
        new_model = to_state.apps.get_model(app_label, self.name)
        if self.allow_migrate_model(schema_editor.connection.alias, new_model):
            old_model = from_state.apps.get_model(app_label, self.name)
            self.alter_unique_together(
                schema_editor,
                new_model,
                getattr(old_model._meta, self.option_name, set()),
                getattr(new_model._meta, self.option_name, set()),
            )

    def alter_unique_together(self, schema_editor, model, old_unique_together, new_unique_together):
        """
        Note: This is copied out of
        django.db.backends.base.schema::BaseDatabaseSchemaEditor.alter_unique_together
        and modified. We'll need to make sure this keeps working after Django upgrades.

        Deals with a model changing its unique_together.
        Note: The input unique_togethers must be doubly-nested, not the single-
        nested ["foo", "bar"] format.
        """
        olds = set(tuple(fields) for fields in old_unique_together)
        news = set(tuple(fields) for fields in new_unique_together)
        # Deleted uniques
        for fields in olds.difference(news):
            schema_editor._delete_composed_index(
                model, fields, {"unique": True}, schema_editor.sql_delete_unique
            )

        # Created uniques
        for fields in news.difference(olds):
            columns = [model._meta.get_field(field).column for field in fields]

            name = schema_editor.quote_name(
                schema_editor._create_index_name(model, columns, suffix="_uniq")
            )
            schema_editor.execute(
                "CREATE UNIQUE INDEX CONCURRENTLY {} ON {} ({})".format(
                    name,
                    model._meta.db_table,
                    ", ".join(schema_editor.quote_name(column) for column in columns),
                )
            )
            schema_editor.execute(
                "ALTER TABLE {} ADD CONSTRAINT {} UNIQUE USING INDEX {}".format(
                    model._meta.db_table, name, name
                )
            )
