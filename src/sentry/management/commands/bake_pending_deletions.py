from __future__ import annotations

import os
from typing import Any, TypedDict

from django.conf import settings
from django.core.management.base import BaseCommand, CommandParser
from django.db.migrations.loader import MigrationLoader
from django.db.migrations.operations import (
    AddConstraint,
    AddField,
    AddIndex,
    AlterUniqueTogether,
    CreateModel,
)
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


def _index_or_constraint_refs(obj: Any, deferred: set[str]) -> bool:
    # A CheckConstraint has no `.fields`; its condition can reference any column, so
    # conservatively treat it as referencing a deferred field when one exists.
    fields = getattr(obj, "fields", None)
    if fields is None:
        return True
    return any(name.lstrip("-") in deferred for name in fields)


def _split_deferred_options(ms: ModelState, deferred: set[str]) -> tuple[dict[str, Any], list[Any]]:
    # A table-level index/constraint/unique_together that references a held-back FK
    # can't be built inside the CreateModel (the column isn't there yet), so it is
    # removed from the CreateModel and re-emitted after the FK is added back.
    options = dict(ms.options)
    reemit: list[Any] = []
    if not deferred:
        return options, reemit

    unique_together = options.get("unique_together") or ()
    if any(set(group) & deferred for group in unique_together):
        options.pop("unique_together", None)
        reemit.append(AlterUniqueTogether(name=ms.name_lower, unique_together=unique_together))

    kept_indexes: list[Any] = []
    moved_indexes: list[Any] = []
    for index in options.get("indexes", []):
        (moved_indexes if _index_or_constraint_refs(index, deferred) else kept_indexes).append(
            index
        )
    if moved_indexes:
        options["indexes"] = kept_indexes
        reemit += [AddIndex(model_name=ms.name_lower, index=index) for index in moved_indexes]

    kept_constraints: list[Any] = []
    moved_constraints: list[Any] = []
    for constraint in options.get("constraints", []):
        target = (
            moved_constraints
            if _index_or_constraint_refs(constraint, deferred)
            else kept_constraints
        )
        target.append(constraint)
    if moved_constraints:
        options["constraints"] = kept_constraints
        reemit += [AddConstraint(model_name=ms.name_lower, constraint=c) for c in moved_constraints]

    return options, reemit


def _relation_key(target: Any, app_label: str) -> tuple[str, str] | None:
    if target is None:
        return None
    if isinstance(target, str):
        target_app, _, name = target.partition(".")
        return (target_app.lower(), name.lower()) if name else (app_label, target_app.lower())
    return (target._meta.app_label, target._meta.model_name)


def _references_pending(field: Any, app_label: str, keys: set[tuple[str, str]]) -> bool:
    # Whether a relation field points at a model that is itself pending in this batch,
    # via either its target or an m2m `through`. Such a field can't be created inline
    # (its target may not exist yet, or the reference may be cyclic, or the m2m through
    # table is a separate pending model) so it is held back to a post-CreateModel
    # AddField once every pending table exists.
    remote = getattr(field, "remote_field", None)
    if remote is None:
        return False
    for target in (getattr(remote, "model", None), getattr(remote, "through", None)):
        if _relation_key(target, app_label) in keys:
            return True
    return False


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

    def _render_into(bucket: dict[str, list[str]], app_label: str, op: Any) -> None:
        _, imports = _app(app_label)
        text, op_imports = _render(op)
        bucket.setdefault(app_label, []).append(text)
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

    # a field pended before its model is absent from the stored snapshot the
    # CreateModel renders, so its column must be re-added; a field the snapshot
    # already carries must not be, or the column is duplicated.
    model_states: dict[tuple[str, str], ModelState] = {}
    for key, model in sorted(pending_models.items()):
        if key[0] in squashed:
            model_states[key] = ModelState.from_model(model)
    pending_keys = set(model_states)

    build_ops: dict[str, list[str]] = {}
    teardown_ops: dict[str, list[str]] = {}

    # Phase 1a: create every table, holding back any FK that points to another pending
    # model. No CreateModel order can resolve a mutual or forward reference between two
    # pending models, so those columns are added once all the tables exist — the same
    # split Django's own autodetector makes for circular dependencies.
    deferred_relations: list[tuple[str, str, str, Any]] = []
    deferred_options: list[tuple[str, Any]] = []
    for (app_label, _model_name), ms in model_states.items():
        kept = []
        deferred_names = set()
        for field_name, field in ms.fields.items():
            if _references_pending(field, app_label, pending_keys):
                deferred_relations.append((app_label, ms.name_lower, field_name, field))
                deferred_names.add(field_name)
            else:
                kept.append((field_name, field))
                _add_dep(app_label, field)
        options, reemit = _split_deferred_options(ms, deferred_names)
        for op in reemit:
            deferred_options.append((app_label, op))
        _render_into(
            build_ops,
            app_label,
            CreateModel(
                name=ms.name,
                fields=kept,
                options=options,
                bases=ms.bases,
                managers=ms.managers,
            ),
        )

    # Phase 1b: add the held-back inter-pending FKs now that every target table exists,
    # then re-emit the indexes and constraints that referenced them.
    for app_label, model_name, field_name, field in deferred_relations:
        _render_into(
            build_ops, app_label, AddField(model_name=model_name, name=field_name, field=field)
        )
        _add_dep(app_label, field)
    for app_label, op in deferred_options:
        _render_into(build_ops, app_label, op)

    for (app_label, model_name), fields in fields_by_model.items():
        carried = model_states.get((app_label, model_name))
        already_present = frozenset(carried.fields) if carried is not None else frozenset()
        for field_name, field in fields:
            if field_name in already_present:
                continue
            _render_into(
                build_ops, app_label, AddField(model_name=model_name, name=field_name, field=field)
            )
            _add_dep(app_label, field)

    # Phase 2: move everything to pending, fields before their models and models
    # in reverse of Phase 1 so a referencing object leaves state before its target.
    for (app_label, model_name), fields in fields_by_model.items():
        for field_name, _field in fields:
            _render_into(
                teardown_ops,
                app_label,
                SafeRemoveField(
                    model_name=model_name,
                    name=field_name,
                    deletion_action=DeletionAction.MOVE_TO_PENDING,
                ),
            )
    for (app_label, _model_name), ms in reversed(model_states.items()):
        _render_into(
            teardown_ops,
            app_label,
            SafeDeleteModel(name=ms.name, deletion_action=DeletionAction.MOVE_TO_PENDING),
        )

    for app_label, app in result.items():
        app["operations"] = build_ops.get(app_label, []) + teardown_ops.get(app_label, [])
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
        with open(os.path.join(settings.MIGRATIONS_LOCKFILE_PATH, LOCKFILE)) as f:
            squashed_apps = squashed_apps_from_lockfile(f.read())
        with open(options["out"], "w") as f:
            json.dump(_dump(squashed_apps), f)
