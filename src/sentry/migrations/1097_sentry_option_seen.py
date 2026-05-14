from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    is_post_deployment = False

    dependencies = [
        ("sentry", "1096_backfill_mcp_dashboard_widget_filters"),
    ]

    operations = [
        migrations.CreateModel(
            name="OptionSeen",
            fields=[
                ("key", models.CharField(max_length=128, primary_key=True, serialize=False)),
            ],
            options={
                "db_table": "sentry_option_seen",
            },
        ),
    ]
