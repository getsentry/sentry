from __future__ import annotations

from collections.abc import Iterable
from enum import Enum

from django.core.exceptions import FieldDoesNotExist
from django.db.migrations.state import ModelState, ProjectState

# django-stubs still declares this in `django.db.migrations.operations.utils`.
from django.db.migrations.utils import resolve_relation  # type: ignore[attr-defined]
from django.db.models import Field, Model
from django_zero_downtime_migrations.backends.postgres.schema import UnsafeOperationException


class DeletionAction(Enum):
    MOVE_TO_PENDING = 0
    DELETE = 1


class SentryProjectState(ProjectState):
    """
    Keeps the models and fields that `DeletionAction.MOVE_TO_PENDING` removed, so the later
    `DeletionAction.DELETE` can drop them from the database.

    They're kept as unrendered `ModelState`s and fields: rendering `apps` while replaying the
    migration history makes every later operation re-render models. They're only rendered
    when a delete step asks for them.
    """

    def __init__(
        self,
        models: dict[tuple[str, str], ModelState] | None = None,
        real_apps: set[str] | None = None,
    ) -> None:
        super().__init__(models=models, real_apps=real_apps)
        self.pending_deletion_models: dict[tuple[str, str], ModelState] = {}
        self.pending_deletion_fields: dict[tuple[str, str, str], Field[object, object]] = {}
        # Models whose DELETE already ran. Pending deletions can still point at them, like an
        # M2M `through` that is deleted before the model declaring it, and need them to render.
        self.deleted_models: dict[tuple[str, str], ModelState] = {}

    def get_model_state(self, app_label: str, model_name: str) -> ModelState:
        try:
            return self.models[app_label, model_name.lower()]
        except KeyError:
            raise LookupError(f"App '{app_label}' doesn't have a '{model_name}' model.") from None

    def get_field_state(self, app_label: str, model_name: str, name: str) -> Field[object, object]:
        model_state = self.get_model_state(app_label, model_name)
        try:
            return model_state.fields[name]
        except KeyError:
            raise FieldDoesNotExist(f"{model_state.name} has no field named '{name}'") from None

    def get_pending_deletion_model(self, app_label: str, model_name: str) -> type[Model]:
        model_key = (app_label.lower(), model_name.lower())
        if model_key not in self.pending_deletion_models:
            raise UnsafeOperationException(
                "Model must be in the pending deletion state before full deletion. "
                "More info: https://develop.sentry.dev/api-server/application-domains/database-migrations/#deleting-tables"
            )
        return self._render_pending_deletions([model_key], []).apps.get_model(*model_key)

    def get_pending_deletion_field(
        self, app_label: str, model_name: str, field_name: str
    ) -> Field[object, object]:
        field_key = (app_label.lower(), model_name.lower(), field_name.lower())
        if field_key not in self.pending_deletion_fields:
            raise UnsafeOperationException(
                "Field must be in the pending deletion state before full deletion. "
                "More info: https://develop.sentry.dev/api-server/application-domains/database-migrations/#deleting-columns"
            )
        model = self._render_pending_deletions([], [field_key]).apps.get_model(*field_key[:2])
        return model._meta.get_field(field_key[2])

    def render_pending_deletions(self) -> tuple[list[Field[object, object]], list[type[Model]]]:
        """Render every pending deletion at once, fields first, each in the order it went pending."""
        state = self._render_pending_deletions(
            self.pending_deletion_models, self.pending_deletion_fields
        )
        fields = [
            state.apps.get_model(app_label, model_name)._meta.get_field(name)
            for app_label, model_name, name in self.pending_deletion_fields
        ]
        models = [state.apps.get_model(*key) for key in self.pending_deletion_models]
        return fields, models

    def _render_pending_deletions(
        self,
        model_keys: Iterable[tuple[str, str]],
        field_keys: Iterable[tuple[str, str, str]],
    ) -> SentryProjectState:
        """
        Return a throwaway copy of this state with the given pending deletions added back.

        Pending or deleted models that those deletions point at (a field's model, a relation's
        target or `through`) are added too, so their relations resolve.
        """
        field_keys = list(field_keys)
        to_add: dict[tuple[str, str], ModelState] = {}

        def visit_relations(field: Field[object, object], key: tuple[str, str]) -> None:
            if (remote_field := field.remote_field) is not None:
                visit(resolve_relation(remote_field.model, *key))
                if (through := getattr(remote_field, "through", None)) is not None:
                    visit(resolve_relation(through, *key))

        def visit(key: tuple[str, str]) -> None:
            if key in self.models or key in to_add:
                return
            model_state = self.pending_deletion_models.get(key) or self.deleted_models.get(key)
            if model_state is None:
                return
            to_add[key] = model_state
            for field in model_state.fields.values():
                visit_relations(field, key)

        for model_key in model_keys:
            visit(model_key)
        for field_key in field_keys:
            visit(field_key[:2])
            visit_relations(self.pending_deletion_fields[field_key], field_key[:2])

        # Render this state once so the copy clones its registry and only re-renders the
        # models related to what's added back.
        _ = self.apps
        state = self.clone()
        for model_state in to_add.values():
            state.add_model(model_state.clone())
        for app_label, model_name, name in field_keys:
            field = self.pending_deletion_fields[app_label, model_name, name]
            state.add_field(app_label, model_name, name, field, preserve_default=True)
        return state

    def remove_model(
        self, app_label: str, model_name: str, deletion_action: DeletionAction | None = None
    ) -> None:
        model_key = (app_label.lower(), model_name.lower())
        if deletion_action == DeletionAction.DELETE:
            if model_key not in self.pending_deletion_models:
                raise UnsafeOperationException(
                    "Model must be in the pending deletion state before full deletion. "
                    "More info: https://develop.sentry.dev/api-server/application-domains/database-migrations/#deleting-tables"
                )
            self.deleted_models[model_key] = self.pending_deletion_models.pop(model_key)
            return
        if deletion_action == DeletionAction.MOVE_TO_PENDING:
            if model_key in self.pending_deletion_models:
                raise UnsafeOperationException(
                    f"{app_label}.{model_name} is already pending deletion. Use DeletionAction.DELETE to delete"
                    "More info: https://develop.sentry.dev/api-server/application-domains/database-migrations/#deleting-tables"
                )
            self.pending_deletion_models[model_key] = self.get_model_state(app_label, model_name)
        super().remove_model(app_label, model_name)

    def remove_field(
        self,
        app_label: str,
        model_name: str,
        name: str,
        deletion_action: DeletionAction | None = None,
    ) -> None:
        field_key = app_label.lower(), model_name.lower(), name.lower()
        if deletion_action == DeletionAction.DELETE:
            if field_key not in self.pending_deletion_fields:
                raise UnsafeOperationException(
                    "Field must be in the pending deletion state before full deletion. "
                    "More info: https://develop.sentry.dev/api-server/application-domains/database-migrations/#deleting-columns"
                )
            del self.pending_deletion_fields[field_key]
            return

        if deletion_action == DeletionAction.MOVE_TO_PENDING:
            if field_key in self.pending_deletion_fields:
                raise UnsafeOperationException(
                    f"{app_label}.{model_name}.{name} is already pending deletion. Use DeletionAction.DELETE to delete"
                    "More info: https://develop.sentry.dev/api-server/application-domains/database-migrations/#deleting-columns"
                )
            self.pending_deletion_fields[field_key] = self.get_field_state(
                app_label, model_name, name
            )

        super().remove_field(app_label, model_name, name)

    def clone(self) -> SentryProjectState:
        new_state = super().clone()
        # These model and field states are never mutated, so the copies can share them.
        new_state.pending_deletion_models = dict(self.pending_deletion_models)  # type: ignore[attr-defined]
        new_state.pending_deletion_fields = dict(self.pending_deletion_fields)  # type: ignore[attr-defined]
        new_state.deleted_models = dict(self.deleted_models)  # type: ignore[attr-defined]
        return new_state  # type: ignore[return-value]
