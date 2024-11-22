from django.db.migrations import RemoveField
from django.db.models import Field
from django.db.models.fields import NOT_PROVIDED
from django_zero_downtime_migrations.backends.postgres.schema import UnsafeOperationException

from sentry.db.postgres.schema import SafePostgresDatabaseSchemaEditor
from sentry.new_migrations.monkey.state import DeletionAction, SentryProjectState

IGNORED_ATTRS = ["verbose_name", "help_text", "choices"]
original_deconstruct = Field.deconstruct


def deconstruct(self):
    """
    Overrides the default field deconstruct method. This is used to pop unwanted
    keyword arguments from the field during deconstruction, so that they will be ignored
    when generating migrations.
    """
    name, path, args, kwargs = original_deconstruct(self)
    for attr in IGNORED_ATTRS:
        kwargs.pop(attr, None)
    return name, path, args, kwargs


class SafeRemoveField(RemoveField):
    def __init__(self, *args, deletion_action: DeletionAction, **kwargs):
        super().__init__(*args, **kwargs)
        self.deletion_action = deletion_action

    def state_forwards(self, app_label: str, state: SentryProjectState) -> None:  # type: ignore[override]
        if self.deletion_action == DeletionAction.MOVE_TO_PENDING:
            field = state.apps.get_model(app_label, self.model_name_lower)._meta.get_field(
                self.name_lower
            )
            if getattr(field, "db_constraint", False):
                raise UnsafeOperationException(
                    f"Foreign key db constraint must be removed before dropping {app_label}.{self.model_name_lower}.{self.name}. "
                    "More info: https://develop.sentry.dev/api-server/application-domains/database-migrations/#deleting-columns"
                )
            if not field.null and field.db_default is NOT_PROVIDED:
                raise UnsafeOperationException(
                    f"Field {app_label}.{self.model_name_lower}.{self.name} must either be nullable or have a db_default before dropping. "
                    "More info: https://develop.sentry.dev/api-server/application-domains/database-migrations/#deleting-columns"
                )

        state.remove_field(
            app_label, self.model_name_lower, self.name_lower, deletion_action=self.deletion_action
        )

    def database_forwards(
        self,
        app_label: str,
        schema_editor: SafePostgresDatabaseSchemaEditor,  # type: ignore[override]
        from_state: SentryProjectState,  # type: ignore[override]
        to_state: SentryProjectState,  # type: ignore[override]
    ) -> None:
        if self.deletion_action == DeletionAction.MOVE_TO_PENDING:
            return

        field = from_state.get_pending_deletion_field(app_label, self.model_name, self.name)
        if self.allow_migrate_model(schema_editor.connection.alias, field.model):
            schema_editor.remove_field(field.model, field, is_safe=True)

    def database_backwards(
        self,
        app_label: str,
        schema_editor: SafePostgresDatabaseSchemaEditor,  # type: ignore[override]
        from_state: SentryProjectState,  # type: ignore[override]
        to_state: SentryProjectState,  # type: ignore[override]
    ) -> None:
        if self.deletion_action == DeletionAction.MOVE_TO_PENDING:
            return
        field = to_state.get_pending_deletion_field(app_label, self.model_name, self.name)
        if self.allow_migrate_model(schema_editor.connection.alias, field.model):
            schema_editor.add_field(field.model, field)

    def describe(self) -> str:
        if self.deletion_action == DeletionAction.MOVE_TO_PENDING:
            return f"Moved {self.model_name}.{self.name} field to pending deletion state"
        else:
            return super().describe()
