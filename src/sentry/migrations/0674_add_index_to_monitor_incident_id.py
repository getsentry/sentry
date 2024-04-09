from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        (\"sentry\", \"0673_add_env_muted_to_broken_detection\"),
    ]

    operations = [
        migrations.AddIndex(
            model_name=\"monitorenvbrokendetection\",
            index=migrations.Index(fields=[\"monitor_incident\"], name=\"monitor_incident_id_idx\"),
        ),
    ]
