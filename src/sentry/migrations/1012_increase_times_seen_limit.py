from django.db import migrations
import sentry.db.models.fields.bounded


class Migration(migrations.Migration):
    dependencies = [
        ("sentry", "1011_update_oc_integration_cascade_to_null"),
    ]

    operations = [
        migrations.AlterField(
            model_name="group",
            name="times_seen",
            field=sentry.db.models.fields.bounded.BoundedPositiveBigIntegerField(
                db_index=True,
                default=1,
            ),
        ),
        migrations.AlterField(
            model_name="grouptombstone",
            name="times_seen",
            field=sentry.db.models.fields.bounded.BoundedPositiveBigIntegerField(
                db_default=0,
            ),
        ),
    ]
