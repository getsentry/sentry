from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    is_post_deployment = True

    dependencies = [
        ("workflow_engine", "0108_remove_sentry_app_identifier_from_action"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="detectorstate",
            index=models.Index(
                fields=["is_triggered", "date_updated"],
                condition=models.Q(is_triggered=True),
                name="detector_state_triggered_date",
            ),
        ),
    ]
