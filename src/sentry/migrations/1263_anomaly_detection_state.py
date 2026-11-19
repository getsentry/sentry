import django.db.models.deletion
import sentry.db.models.fields.bounded
import sentry.db.models.fields.foreignkey
from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    is_post_deployment = False

    dependencies = [("sentry", "1262_remove_gal_project_option_value_id_index")]

    operations = [
        migrations.CreateModel(
            name="AnomalyDetectionState",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        primary_key=True, serialize=False
                    ),
                ),
                ("date_updated", models.DateTimeField(auto_now=True)),
                ("date_added", models.DateTimeField(auto_now_add=True)),
                ("next_minute", models.DateTimeField()),
                ("checkpoint", models.BinaryField()),
                (
                    "organization",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        db_index=False,
                        on_delete=django.db.models.deletion.CASCADE,
                        to="sentry.organization",
                    ),
                ),
            ],
            options={
                "db_table": "sentry_anomalydetectionstate",
                "constraints": [
                    models.UniqueConstraint(
                        fields=("organization",), name="sentry_anomaly_state_org_uniq"
                    )
                ],
            },
        )
    ]
