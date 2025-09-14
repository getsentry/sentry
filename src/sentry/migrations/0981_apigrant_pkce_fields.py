from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    # Simple nullable columns; safe to run during deploy
    is_post_deployment = False

    dependencies = [
        ("sentry", "0980_integrations_json_field"),
    ]

    operations = [
        migrations.AddField(
            model_name="apigrant",
            name="code_challenge",
            field=models.CharField(max_length=128, null=True, blank=True),
        ),
        migrations.AddField(
            model_name="apigrant",
            name="code_challenge_method",
            field=models.CharField(max_length=10, null=True, blank=True),
        ),
    ]
