# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, transaction


def remove_trailing_spaces(apps, schema_editor):
    """
    There are currently only two organizations with trailing spaces so we're
    updating them with python. Using SQL would lock the table for too long.
    """
    Organization = apps.get_model("sentry", "Organization")

    for organization in Organization.objects.filter(slug__endswith=" "):
        organization.slug = organization.slug.strip()
        organization.save()


class Migration(migrations.Migration):
    # This flag is used to mark that a migration shouldn't be automatically run in
    # production. We set this to True for operations that we think are risky and want
    # someone from ops to run manually and monitor.
    # General advice is that if in doubt, mark your migration as `is_dangerous`.
    # Some things you should always mark as dangerous:
    # - Large data migrations. Typically we want these to be run manually by ops so that
    #   they can be monitored. Since data migrations will now hold a transaction open
    #   this is even more important.
    # - Adding columns to highly active tables, even ones that are NULL.
    is_dangerous = False

    # This flag is used to decide whether to run this migration in a transaction or not.
    # By default we prefer to run in a transaction, but for migrations where you want
    # to `CREATE INDEX CONCURRENTLY` this needs to be set to False. Typically you'll
    # want to create an index concurrently when adding one to an existing table.
    atomic = False

    dependencies = [("sentry", "0106_service_hook_project_id_nullable")]

    operations = [
        migrations.RunPython(
            remove_trailing_spaces, reverse_code=migrations.RunPython.noop
        )
    ]
