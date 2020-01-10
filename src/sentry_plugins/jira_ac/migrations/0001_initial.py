# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import sentry.db.models.fields.bounded
import sentry.db.models.fields.foreignkey


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

    dependencies = [("sentry", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="JiraTenant",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("client_key", models.CharField(unique=True, max_length=50)),
                ("secret", models.CharField(max_length=100)),
                ("base_url", models.CharField(max_length=60)),
                ("public_key", models.CharField(max_length=250)),
                (
                    "organization",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        related_name="jira_tenant_set",
                        blank=True,
                        to="sentry.Organization",
                        null=True,
                    ),
                ),
            ],
            options={"db_table": "jira_ac_tenant"},
        )
    ]
