# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


def fix_content_types(apps, schema_editor):
    # XXX: This is a gross hack. We missed removing this column a long time ago while
    # upgrading Django. Since different databases might be in different states depending
    # on which path they take to get to Django migrations, it's safest to just check
    # if the column exists for everyone, and remove it if so. This removal is safe,
    # since the column has been long removed from the Django model.

    c = schema_editor.connection.cursor()
    c.execute(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='django_content_type' and column_name='name';
        """
    )
    results = c.fetchall()
    if len(results):
        c.execute('ALTER TABLE django_content_type DROP COLUMN "name";')
    c.close()


class Migration(migrations.Migration):
    # This flag is used to mark that a migration shouldn't be automatically run in
    # production. We set this to True for operations that we think are risky and want
    # someone from ops to run manually and monitor.
    # General advice is that if in doubt, mark your migration as `is_dangerous`.
    # Some things you should always mark as dangerous:
    # - Adding indexes to large tables. These indexes should be created concurrently,
    #   unfortunately we can't run migrations outside of a transaction until Django
    #   1.10. So until then these should be run manually.
    # - Large data migrations. Typically we want these to be run manually by ops so that
    #   they can be monitored. Since data migrations will now hold a transaction open
    #   this is even more important.
    # - Adding columns to highly active tables, even ones that are NULL.
    is_dangerous = False

    dependencies = [
        (
            "sentry",
            "0004_bitfieldtestmodel_blankjsonfieldtestmodel_callabledefaultmodel_jsonfieldtestmodel_jsonfieldwithdefau",
        )
    ]

    operations = [migrations.RunPython(fix_content_types)]
