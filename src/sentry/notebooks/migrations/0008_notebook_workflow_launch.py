from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    is_post_deployment = False
    dependencies = [("notebooks", "0007_relational_workflow_evidence")]
    operations = [
        migrations.AddField(
            model_name="notebook", name="workflow_launch", field=models.JSONField(null=True)
        )
    ]
