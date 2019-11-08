# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


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
        ('sentry', '0012_remove_pagerdutyservice_service_id'),
    ]

    migrations.SeparateDatabaseAndState(
        database_operations=[
            migrations.RunSQL(
                """
                ALTER TABLE "sentry_sentryappwebhookerror" DROP CONSTRAINT "organization_id_refs_id_e5de1b55";
                ALTER TABLE "sentry_sentryappwebhookerror" DROP CONSTRAINT "sentry_app_id_refs_id_def41997";
                """
            )
        ],
        state_operations=[
            migrations.RemoveField(
                model_name='sentryappwebhookerror',
                name='organization',
            ),
            migrations.RemoveField(
                model_name='sentryappwebhookerror',
                name='sentry_app',
            ),
            migrations.DeleteModel(
                name='SentryAppWebhookError',
            ),
        ],
    )
