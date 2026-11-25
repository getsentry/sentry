from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    is_post_deployment = False
    dependencies = [("notebooks", "0006_workflow_notebooks")]
    operations = [
        migrations.AddField(
            model_name="notebook", name="workflow_launch", field=models.JSONField(null=True)
        )
    ]
