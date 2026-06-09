from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    # Nullable column addition is safe at deploy time for tables of any size.
    is_post_deployment = False

    dependencies = [
        ("sentry", "1109_add_group_action_log_entry"),
    ]

    operations = [
        migrations.AddField(
            model_name="pullrequest",
            name="head_branch",
            field=models.CharField(max_length=255, null=True),
        ),
    ]
