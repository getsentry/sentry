import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0002_notificationmessage_jsonfield"),
    ]

    operations = [
        migrations.CreateModel(
            name="NotificationThread",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("thread_key", models.CharField(db_index=True, max_length=64)),
                ("provider_key", models.CharField(max_length=32)),
                ("target_id", models.CharField(max_length=255)),
                ("thread_identifier", models.CharField(max_length=255)),
                ("key_type", models.CharField(max_length=64)),
                ("key_data", models.JSONField()),
                ("provider_data", models.JSONField(default=dict)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                "db_table": "sentry_notificationthread",
            },
        ),
        migrations.AddConstraint(
            model_name="notificationthread",
            constraint=models.UniqueConstraint(
                fields=("thread_key", "provider_key", "target_id"),
                name="uniq_notification_thread_per_provider_target",
            ),
        ),
        migrations.CreateModel(
            name="NotificationRecord",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("provider_key", models.CharField(max_length=32)),
                ("target_id", models.CharField(max_length=255)),
                ("message_id", models.CharField(max_length=255)),
                ("error_details", models.JSONField(null=True)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "thread",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="records",
                        to="notifications.notificationthread",
                    ),
                ),
            ],
            options={
                "db_table": "sentry_notificationrecord",
            },
        ),
        migrations.AddIndex(
            model_name="notificationrecord",
            index=models.Index(
                fields=["thread", "date_added"],
                name="idx_notificationrecord_thread_date",
            ),
        ),
    ]
