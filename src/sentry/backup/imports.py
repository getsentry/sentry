from __future__ import annotations

from io import StringIO

import click
from django.apps import apps
from django.core import management, serializers
from django.db import IntegrityError, connection, transaction

from sentry.backup.helpers import EXCLUDED_APPS


def imports(src, printer=click.echo):
    """CLI command wrapping the `exec_import` functionality."""

    try:
        # Import / export only works in monolith mode with a consolidated db.
        with transaction.atomic("default"):
            for obj in serializers.deserialize("json", src, stream=True, use_natural_keys=True):
                if obj.object._meta.app_label not in EXCLUDED_APPS:
                    obj.save()
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
