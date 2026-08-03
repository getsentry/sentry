import django.db.models.deletion
import sentry.db.models.fields.foreignkey
from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    is_post_deployment = False

    dependencies = [
        ("investigations", "0003_add_investigation_favorites"),
    ]

    operations = [
        migrations.AddField(
            model_name="investigationcell",
            name="content_execution",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="investigations.investigationcellexecution",
            ),
        ),
        migrations.AlterField(
            model_name="investigationcellexecution",
            name="executor",
            field=models.CharField(
                choices=[
                    ("manual", "Manual"),
                    ("deterministic", "Deterministic"),
                    ("assisted_query", "Assisted query"),
                    ("code_mode", "Code mode"),
                    ("text_generation", "Text generation"),
                ],
                max_length=32,
            ),
        ),
    ]
