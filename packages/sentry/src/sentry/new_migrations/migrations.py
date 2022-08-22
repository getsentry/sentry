from django.db.migrations import Migration


class CheckedMigration(Migration):
    """
    Migrations subclassing this will perform safety checks to help ensure that they
    won't cause production issues during deploy.
    """

    checked = True

    def apply(self, project_state, schema_editor, collect_sql=False):
        if self.checked:
            schema_editor.safe = True
        return super().apply(project_state, schema_editor, collect_sql)
