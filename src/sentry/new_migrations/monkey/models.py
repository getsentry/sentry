from django.db.migrations import DeleteModel
from django_zero_downtime_migrations.backends.postgres.schema import UnsafeOperationException

from sentry.db.postgres.schema import SafePostgresDatabaseSchemaEditor
from sentry.new_migrations.monkey.state import DeletionAction, SentryProjectState


class SafeDeleteModel(DeleteModel):
    def __init__(self, *args, deletion_action: DeletionAction, **kwargs):
        super().__init__(*args, **kwargs)
        self.deletion_action = deletion_action

    def state_forwards(self, app_label: str, state: SentryProjectState) -> None:  # type: ignore[override]
        if self.deletion_action == DeletionAction.MOVE_TO_PENDING:
            model = state.apps.get_model(app_label, self.name)
            fields_with_constraints = [
                f.name for f in model._meta.fields if getattr(f, "db_constraint", False)
            ]
            if fields_with_constraints:
                raise UnsafeOperationException(
                    "Foreign key db constraints must be removed before dropping "
                    f"{app_label}.{self.name}. Fields with constraints: {fields_with_constraints}"
                    "More info: https://develop.sentry.dev/api-server/application-domains/database-migrations/#deleting-tables"
                )
        state.remove_model(app_label, self.name_lower, deletion_action=self.deletion_action)

    def database_forwards(
        self,
        app_label: str,
        schema_editor: SafePostgresDatabaseSchemaEditor,  # type: ignore[override]
        from_state: SentryProjectState,  # type: ignore[override]
        to_state: SentryProjectState,  # type: ignore[override]
    ) -> None:
        if self.deletion_action == DeletionAction.MOVE_TO_PENDING:
            return

        model = from_state.get_pending_deletion_model(app_label, self.name)
        if self.allow_migrate_model(schema_editor.connection.alias, model):
            schema_editor.delete_model(model, is_safe=True)

    def database_backwards(
        self,
        app_label: str,
        schema_editor: SafePostgresDatabaseSchemaEditor,  # type: ignore[override]
        from_state: SentryProjectState,  # type: ignore[override]
        to_state: SentryProjectState,  # type: ignore[override]
    ) -> None:
        if self.deletion_action == DeletionAction.MOVE_TO_PENDING:
            return
        model = to_state.get_pending_deletion_model(app_label, self.name)
        if self.allow_migrate_model(schema_editor.connection.alias, model):
            schema_editor.create_model(model)

    def describe(self) -> str:
        if self.deletion_action == DeletionAction.MOVE_TO_PENDING:
            return f"Moved model {self.name} to pending deletion state"
        else:
            return super().describe()
