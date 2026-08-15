from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from django.core.management.base import BaseCommand, CommandParser
from django.db import connections, router
from django.db.backends.base.base import BaseDatabaseWrapper
from django.db.migrations.loader import MigrationLoader
from django.db.migrations.state import ProjectState

from sentry.utils import json

LOCKFILE = "migrations_lockfile.txt"


def squashed_apps_from_lockfile(contents: str) -> set[str]:
    apps = set()
    for line in contents.splitlines():
        if ": " not in line:
            continue
        app, current = line.split(": ", 1)
        if current[4:14] == "_squashed_":
            continue
        apps.add(app.strip())
    return apps


def collect_pending_deletion_ddl(
    state: ProjectState,
    connection: BaseDatabaseWrapper,
    squashed_apps: Iterable[str],
) -> list[str]:
    squashed = {app.lower() for app in squashed_apps}
    pending_models = getattr(state, "pending_deletion_models", {})
    pending_fields = getattr(state, "pending_deletion_fields", {})

    alias = connection.alias
    with connection.schema_editor(collect_sql=True, atomic=False) as schema_editor:
        for (app_label, model_name), model in sorted(pending_models.items()):
            if app_label not in squashed:
                continue
            if not router.allow_migrate_model(alias, model):
                continue
            schema_editor.create_model(model)

        for (app_label, model_name, _field_name), field in sorted(pending_fields.items()):
            if app_label not in squashed:
                continue
            if (app_label, model_name) in state.models:
                model = state.apps.get_model(app_label, model_name)
            elif (app_label, model_name) in pending_models:
                # The model is itself pending: create_model above emitted its table
                # from a snapshot taken after this field was removed from state, so
                # the column is missing and must be added back explicitly.
                model = pending_models[(app_label, model_name)]
            else:
                continue
            if not router.allow_migrate_model(alias, model):
                continue
            schema_editor.add_field(model, field)

    return schema_editor.collected_sql


def _dump(squashed_apps: set[str]) -> dict[str, list[str]]:
    loader = MigrationLoader(None, ignore_no_migrations=True)
    state = loader.project_state(nodes=None, at_end=True)
    result = {}
    for alias in connections:
        sql = collect_pending_deletion_ddl(state, connections[alias], squashed_apps)
        if sql:
            result[alias] = sql
    return result


class Command(BaseCommand):
    help = "Emit or replay DDL that reconstitutes pending safe-deletion columns/tables."

    def add_arguments(self, parser: CommandParser) -> None:
        sub = parser.add_subparsers(dest="action", required=True)
        dump = sub.add_parser("dump", help="Write pending-deletion DDL to a JSON file.")
        dump.add_argument("--out", required=True)
        apply_ = sub.add_parser("apply", help="Replay pending-deletion DDL from a JSON file.")
        apply_.add_argument("path")

    def handle(self, *args: Any, **options: Any) -> None:
        if options["action"] == "dump":
            with open(LOCKFILE) as f:
                squashed_apps = squashed_apps_from_lockfile(f.read())
            with open(options["out"], "w") as f:
                json.dump(_dump(squashed_apps), f)
            return

        with open(options["path"]) as f:
            by_alias = json.load(f)
        for alias, statements in by_alias.items():
            with connections[alias].cursor() as cursor:
                for statement in statements:
                    cursor.execute(statement)
