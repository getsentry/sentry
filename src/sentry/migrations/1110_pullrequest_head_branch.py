from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    is_post_deployment = True

    dependencies = [
        ("sentry", "1109_add_group_action_log_entry"),
    ]

    operations = [
        migrations.AddField(
            model_name="pullrequest",
            name="head_branch",
            field=models.CharField(max_length=255, null=True),
        ),
        migrations.AddIndex(
            model_name="pullrequest",
            index=models.Index(
                fields=["organization_id", "repository_id", "head_branch"],
                name="sentry_pull_organiz_head_branch_idx",
            ),
        ),
    ]
