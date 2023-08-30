from __future__ import annotations

from io import StringIO
from typing import NamedTuple

import click
from django.apps import apps
from django.core import management, serializers
from django.db import IntegrityError, connection, transaction

from sentry.backup.dependencies import PrimaryKeyMap, normalize_model_name
from sentry.backup.helpers import EXCLUDED_APPS
from sentry.backup.scopes import ImportScope
from sentry.silo import unguarded_write

__all__ = (
    "OldImportConfig",
    "import_in_user_scope",
    "import_in_organization_scope",
    "import_in_global_scope",
)


class OldImportConfig(NamedTuple):
    """While we are migrating to the new backup system, we need to take care not to break the old
    and relatively untested workflows. This model allows us to stub in the old configs."""

    # Do we allow users to update existing models, or force them to only insert new ones? The old
    # behavior was to allow updates of already included models, but we want to move away from this.
    # TODO(getsentry/team-ospo#170): This is a noop for now, but will be used as we migrate to
    # `INSERT-only` importing logic.
    use_update_instead_of_create: bool = False

    # Old imports use "natural" foreign keys, which in practice only changes how foreign keys into
    # `sentry.User` are represented.
    use_natural_foreign_keys: bool = False


def _import(src, scope: ImportScope, old_config: OldImportConfig, printer=click.echo):
    """
    Imports core data for a Sentry installation.

    It is generally preferable to avoid calling this function directly, as there are certain combinations of input parameters that should not be used together. Instead, use one of the other wrapper functions in this file, named `import_in_XXX_scope()`.
    """

    try:
        # Import / export only works in monolith mode with a consolidated db.
        # TODO(getsentry/team-ospo#185): the `unguarded_write` is temporary until we get an RPC
        # service up for writing to control silo models.
        with unguarded_write(using="default"), transaction.atomic("default"):
            allowed_relocation_scopes = scope.value
            pk_map = PrimaryKeyMap()
            for obj in serializers.deserialize(
                "json", src, stream=True, use_natural_keys=old_config.use_natural_foreign_keys
            ):
                o = obj.object
                if o._meta.app_label not in EXCLUDED_APPS or o:
                    # TODO(getsentry/team-ospo#183): This conditional should be removed once we want
                    # to roll out the new API to self-hosted.
                    if old_config.use_update_instead_of_create:
                        obj.save()
                    elif o.get_relocation_scope() in allowed_relocation_scopes:
                        o = obj.object
                        written = o.write_relocation_import(pk_map, obj, scope)
                        if written is not None:
                            old_pk, new_pk = written
                            model_name = normalize_model_name(o)
                            pk_map.insert(model_name, old_pk, new_pk)

    # For all database integrity errors, let's warn users to follow our
    # recommended backup/restore workflow before reraising exception. Most of
    # these errors come from restoring on a different version of Sentry or not restoring
    # on a clean install.
    except IntegrityError as e:
        warningText = ">> Are you restoring from a backup of the same version of Sentry?\n>> Are you restoring onto a clean database?\n>> If so then this IntegrityError might be our fault, you can open an issue here:\n>> https://github.com/getsentry/sentry/issues/new/choose"
        printer(
            warningText,
            err=True,
        )
        raise (e)

    sequence_reset_sql = StringIO()

    for app in apps.get_app_configs():
        management.call_command(
            "sqlsequencereset", app.label, "--no-color", stdout=sequence_reset_sql
        )

    with connection.cursor() as cursor:
        cursor.execute(sequence_reset_sql.getvalue())


def import_in_user_scope(src, printer=click.echo):
    """
    Perform an import in the `User` scope, meaning that only models with `RelocationScope.User` will be imported from the provided `src` file.
    """
    return _import(src, ImportScope.User, OldImportConfig(), printer)


def import_in_organization_scope(src, printer=click.echo):
    """
    Perform an import in the `Organization` scope, meaning that only models with `RelocationScope.User` or `RelocationScope.Organization` will be imported from the provided `src` file.
    """
    return _import(src, ImportScope.Organization, OldImportConfig(), printer)


def import_in_global_scope(src, printer=click.echo):
    """
    Perform an import in the `Global` scope, meaning that all models will be imported from the
    provided source file. Because a `Global` import is really only useful when restoring to a fresh
    Sentry instance, some behaviors in this scope are different from the others. In particular,
    superuser privileges are not sanitized.
    """
    return _import(src, ImportScope.Global, OldImportConfig(), printer)
