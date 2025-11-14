from typing import int
from django.db import migrations

import sentry.db.models.fields.bounded
from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    # Introduce ApiApplication.version; default for new rows set to 0 (legacy)
    is_post_deployment = False

    dependencies = [
        ("sentry", "0978_break_commit_fks"),
    ]

    operations = [
        migrations.AddField(
            model_name="apiapplication",
            name="version",
            field=sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                default=0, db_index=True, db_default=0
            ),
        ),
        # Keep default for new rows as 0 (legacy). Later we will bump default to 1 when ready.
    ]
