# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

def hide_environent_none(apps, schema_editor):
    """
    Hide environments that are named none, since they're blacklisted and no longer can be created.

    We should iterate over each environment row individually in python instead so that we don't lock the DB up. This is
    far slower but much safer
    """
    Environment = apps.get_model("sentry", "Environment")
    EnvironmentProject = apps.get_model("sentry", "EnvironmentProject")
    for env in RangeQuerySetWrapperWithProgressBar(Environment.objects.all()):
        if env.name == 'none':
            for project in EnvironmentProject.objects.filter(environment_id=env.id):
                project.is_hidden = True
                project.save()


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
    is_dangerous = True


    dependencies = [
        ("sentry", "0020_auto_20191125_1420"),
    ]

    operations = [
        migrations.RunPython(hide_environent_none, migrations.RunPython.noop)
    ]
