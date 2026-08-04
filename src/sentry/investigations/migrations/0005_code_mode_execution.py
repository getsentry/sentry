import django.db.models.deletion
from django.db import migrations, models
import sentry.db.models.fields.foreignkey
from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    is_post_deployment = False
    dependencies = [("investigations", "0004_add_text_generation_executor")]

    operations = [
        migrations.AddField(
            model_name="investigationcellexecution",
            name="transcript",
            field=models.JSONField(db_default=[], default=list),
        ),
        migrations.AddField(
            model_name="investigationcellexecution",
            name="transcript_truncated",
            field=models.BooleanField(db_default=False, default=False),
        ),
        migrations.AddField(
            model_name="investigationcell",
            name="result_execution",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="investigations.investigationcellexecution",
            ),
        ),
        migrations.AddField(
            model_name="investigation",
            name="title_generation_status",
            field=models.CharField(max_length=32, null=True),
        ),
        migrations.AddField(
            model_name="investigation",
            name="source_key",
            field=models.CharField(max_length=64, null=True),
        ),
        migrations.AddField(
            model_name="investigation",
            name="title_seer_run",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="seer.seerrun",
            ),
        ),
        migrations.AddConstraint(
            model_name="investigation",
            constraint=models.UniqueConstraint(
                condition=models.Q(("source_key__isnull", False)),
                fields=("organization", "source_type", "source_key"),
                name="investigation_unique_source_key",
            ),
        ),
    ]
