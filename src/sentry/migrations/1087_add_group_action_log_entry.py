import django.db.models.functions.datetime
import django.db.models.deletion
import sentry.db.models.fields.bounded
import sentry.db.models.fields.foreignkey
from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    is_post_deployment = False

    dependencies = [
        ("sentry", "1086_add_source_to_external_actor"),
    ]

    operations = [
        migrations.CreateModel(
            name="GroupActionLogEntry",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        primary_key=True, serialize=False
                    ),
                ),
                ("group_id", sentry.db.models.fields.bounded.BoundedBigIntegerField()),
                (
                    "project_id",
                    sentry.db.models.fields.bounded.BoundedBigIntegerField(),
                ),
                (
                    "original_group_id",
                    sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True),
                ),
                ("type", sentry.db.models.fields.bounded.BoundedPositiveIntegerField()),
                (
                    "actor_type",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(),
                ),
                ("actor_id", sentry.db.models.fields.bounded.BoundedBigIntegerField()),
                ("data", models.JSONField(default=dict)),
                (
                    "date_added",
                    models.DateTimeField(db_default=django.db.models.functions.datetime.Now()),
                ),
                ("date_updated", models.DateTimeField(auto_now=True)),
                ("idempotency_key", models.CharField(max_length=64, null=True)),
            ],
            options={
                "db_table": "sentry_groupactionlogentry",
                "indexes": [
                    models.Index(
                        fields=["group_id", "date_added", "id"],
                        name="sentry_grou_group_i_cc465f_idx",
                    )
                ],
                "constraints": [
                    models.UniqueConstraint(
                        condition=models.Q(("idempotency_key__isnull", False)),
                        fields=("group_id", "idempotency_key"),
                        name="uniq_groupactionlogentry_group_idempotency_key",
                    )
                ],
            },
        ),
        migrations.CreateModel(
            name="GroupDerivedData",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        primary_key=True, serialize=False
                    ),
                ),
                ("date_updated", models.DateTimeField(auto_now=True)),
                ("date_added", models.DateTimeField(auto_now_add=True)),
                (
                    "version",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(default=1),
                ),
                ("cursor_date", models.DateTimeField(default=None)),
                (
                    "cursor_id",
                    sentry.db.models.fields.bounded.BoundedBigIntegerField(default=0),
                ),
                ("data", models.JSONField(default=dict)),
                ("primary", models.BooleanField(default=False)),
                ("last_seen", models.FloatField(default=None, null=True)),
                (
                    "view_count",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(default=0),
                ),
                (
                    "group",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, to="sentry.group"
                    ),
                ),
            ],
            options={
                "db_table": "sentry_groupderiveddata",
                "unique_together": {("group", "version")},
                "indexes": [
                    models.Index(
                        fields=["version"],
                        name="sentry_grou_version_idx",
                    ),
                    models.Index(
                        fields=["group", "primary"],
                        name="sentry_grou_group_p_idx",
                    ),
                ],
            },
        ),
    ]
