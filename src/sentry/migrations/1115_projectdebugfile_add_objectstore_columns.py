from django.db import migrations, models

import sentry.db.models.fields.bounded
import sentry.db.models.fields.foreignkey

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    is_post_deployment = False

    dependencies = [
        ("sentry", "1114_extend_repository_url_length"),
    ]

    operations = [
        migrations.AlterField(
            model_name="projectdebugfile",
            name="file",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                null=True, on_delete=models.PROTECT, to="sentry.file"
            ),
        ),
        migrations.AddField(
            model_name="projectdebugfile",
            name="storage_path",
            field=models.TextField(null=True),
        ),
        migrations.AddField(
            model_name="projectdebugfile",
            name="content_type",
            field=models.TextField(null=True),
        ),
        migrations.AddField(
            model_name="projectdebugfile",
            name="file_size",
            field=sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True),
        ),
        migrations.AddField(
            model_name="projectdebugfile",
            name="date_created",
            field=models.DateTimeField(null=True),
        ),
    ]
