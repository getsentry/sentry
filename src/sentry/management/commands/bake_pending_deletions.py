from __future__ import annotations

from typing import Any, TypedDict

from django.core.management.base import BaseCommand, CommandParser
from django.db.migrations.loader import MigrationLoader
from django.db.migrations.operations import AddField, CreateModel
from django.db.migrations.state import ModelState, ProjectState
from django.db.migrations.writer import OperationWriter

from sentry.new_migrations.monkey.fields import SafeRemoveField
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction
from sentry.utils import json

LOCKFILE = "migrations_lockfile.txt"


class AppInjection(TypedDict):
    operations: list[str]
    imports: list[str]
    dependencies: list[tuple[str, str]]


def squashed_apps_from_lockfile(contents: str) -> set[str]:
    apps = set()
    for line in contents.splitlines():
        if ": " not in line:
            continue
        app_label, name = line.strip().split(": ", 1)
        if not name[4:14] == "_squashed_":
            apps.add(app_label)
    return apps


def _render(op: Any) -> tuple[str, set[str]]:
    return OperationWriter(op).serialize()


def _target_app(model: Any, app_label: str) -> str:
    if isinstance(model, str):
        return model.split(".")[0].lower() if "." in model else app_label
    return model._meta.app_label


def _relation_dependencies(field: Any, app_label: str) -> list[tuple[str, str]]:
    remote = getattr(field, "remote_field", None)
    if remote is None:
        return []
    deps = []
    # an m2m's `through` can live in a third app whose relation is invisible via `to`
    for target in (getattr(remote, "model", None), getattr(remote, "through", None)):
        if target is None:
            continue
        target_app = _target_app(target, app_label)
        dep = (target_app, "__first__")
        if target_app != app_label and dep not in deps:
            deps.append(dep)
    return deps


def build_injection_payload(
    state: ProjectState, squashed_apps: set[str]
) -> dict[str, AppInjection]:
    squashed = {app.lower() for app in squashed_apps}
    pending_fields = getattr(state, "pending_deletion_fields", {})
    pending_models = getattr(state, "pending_deletion_models", {})

    result: dict[str, AppInjection] = {}
    imports_by_app: dict[str, set[str]] = {}

    def _app(app_label: str) -> tuple[AppInjection, set[str]]:
        return (
            result.setdefault(app_label, AppInjection(operations=[], imports=[], dependencies=[])),
            imports_by_app.setdefault(app_label, set()),
        )

    def _emit(app_label: str, op: Any) -> None:
        app, imports = _app(app_label)
        text, op_imports = _render(op)
        app["operations"].append(text)
        imports |= op_imports

    def _add_dep(app_label: str, field: Any) -> None:
        app, _ = _app(app_label)
        for dep in _relation_dependencies(field, app_label):
            if dep not in app["dependencies"]:
                app["dependencies"].append(dep)

    fields_by_model: dict[tuple[str, str], list[tuple[str, Any]]] = {}
    for (app_label, model_name, field_name), field in sorted(pending_fields.items()):
        if app_label not in squashed:
            continue
        model_state = state.models.get((app_label, model_name))
        if model_state is None and (app_label, model_name) not in pending_models:
            continue
        # still live in state, so the squash's CreateModel already carries it and
        # re-adding would duplicate the column
        if model_state is not None and field_name in model_state.fields:
            continue
        fields_by_model.setdefault((app_label, model_name), []).append((field_name, field))

    def _field_ops(
        app_label: str, model_name: str, already_present: frozenset[str] = frozenset()
    ) -> None:
        for field_name, field in fields_by_model.get((app_label, model_name), ()):
            # the reconstructed CreateModel already carries it; re-adding would
            # duplicate the column. Still emit the SafeRemoveField below so the
            # pending registry repopulates on replay.
            if field_name in already_present:
                continue
            _emit(app_label, AddField(model_name=model_name, name=field_name, field=field))
            _add_dep(app_label, field)
        for field_name, _field in fields_by_model.get((app_label, model_name), ()):
            _emit(
                app_label,
                SafeRemoveField(
                    model_name=model_name,
                    name=field_name,
                    deletion_action=DeletionAction.MOVE_TO_PENDING,
                ),
            )

    for (app_label, model_name), model in sorted(pending_models.items()):
        if app_label not in squashed:
            continue
        ms = ModelState.from_model(model)
        _emit(
            app_label,
            CreateModel(
                name=ms.name,
                fields=list(ms.fields.items()),
                options=ms.options,
                bases=ms.bases,
                managers=ms.managers,
            ),
        )
        for model_field in ms.fields.values():
            _add_dep(app_label, model_field)
        # a pending field is always pended before its model, so the stored model was
        # rendered without it: re-add it inside the model's block, before the delete.
        _field_ops(app_label, model_name, already_present=frozenset(ms.fields))
        fields_by_model.pop((app_label, model_name), None)
        _emit(
            app_label,
            SafeDeleteModel(name=ms.name, deletion_action=DeletionAction.MOVE_TO_PENDING),
        )

    for app_label, model_name in list(fields_by_model):
        _field_ops(app_label, model_name)

    for app_label, app in result.items():
        app["imports"] = sorted(imports_by_app[app_label])

    return result


def apps_without_squash_file(state: ProjectState, payload: dict[str, AppInjection]) -> set[str]:
    # makemigrations writes no squash file for an app with no live models, so a
    # payload for such an app cannot be injected — the pending models are its last.
    live_apps = {app_label for app_label, _model_name in state.models}
    return {app_label for app_label in payload if app_label not in live_apps}


def _dump(squashed_apps: set[str]) -> dict[str, Any]:
    loader = MigrationLoader(None, ignore_no_migrations=True)
    state = loader.project_state(nodes=None, at_end=True)
    injections = build_injection_payload(state, squashed_apps)
    return {
        "injections": injections,
        "empty_apps": sorted(apps_without_squash_file(state, injections)),
    }


class Command(BaseCommand):
    help = "Emit op-pairs that bake pending safe-deletes into a regenerated squash."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--out", required=True)

    def handle(self, *args: Any, **options: Any) -> None:
        with open(LOCKFILE) as f:
            squashed_apps = squashed_apps_from_lockfile(f.read())
        with open(options["out"], "w") as f:
            json.dump(_dump(squashed_apps), f)
