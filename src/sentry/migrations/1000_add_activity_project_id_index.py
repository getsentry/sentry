from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    # Adding an index to a large table. Run this post-deployment to avoid blocking deploys.
    # Once deployed, run manually via: https://develop.sentry.dev/database-migrations/#migration-deployment

    is_post_deployment = True

    dependencies = [
        ("sentry", "0999_add_extrapolation_mode_to_snuba_query"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="activity",
            index=models.Index(fields=["project", "id"], name="sentry_acti_project_id_idx"),
        ),
    ]
