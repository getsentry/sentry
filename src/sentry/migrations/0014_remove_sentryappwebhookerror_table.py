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
        ('sentry', '0013_auto_20191108_2104.py'),
    ]

    migrations.SeparateDatabaseAndState(
        database_operations=[
            migrations.RunSQL(
                """
                DROP TABLE "sentry_sentryappwebhookerror";
                """,
                reverse_sql="""
                CREATE TABLE "sentry_sentryappwebhookerror" (
                    id BIGSERIAL PRIMARY KEY,
                    date_added timestamp with time zone NOT NULL,
                    sentry_app_id bigint NOT NULL REFERENCES sentry_sentryapp(id) DEFERRABLE INITIALLY DEFERRED,
                    organization_id bigint NOT NULL REFERENCES sentry_organization(id) DEFERRABLE INITIALLY DEFERRED,
                    request_body text NOT NULL,
                    request_headers text NOT NULL,
                    event_type character varying(64) NOT NULL,
                    webhook_url character varying(200) NOT NULL,
                    response_body text NOT NULL,
                    response_code smallint CHECK (response_code >= 0)
                );
                """
            )
        ],
        state_operations=[],
    )
