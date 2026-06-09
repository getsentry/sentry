from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    # Index creation on a large table; run after deploy to avoid exceeding
    # the 5s migration statement timeout.
    # Once deployed, run manually via: https://develop.sentry.dev/database-migrations/#migration-deployment
    is_post_deployment = True

    dependencies = [
        ("sentry", "1110_pullrequest_head_branch"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="pullrequest",
            index=models.Index(
                fields=["organization_id", "repository_id", "head_branch"],
                name="sentry_pull_organiz_head_branch_idx",
            ),
        ),
    ]
