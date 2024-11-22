from django.db import migrations, models

from sentry.db.models import FlexibleForeignKey
from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):

    initial = True
    checked = False

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="OtherTable",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False)),
            ],
        ),
        migrations.CreateModel(
            name="M2MTable",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                (
                    "alert_rule",
                    FlexibleForeignKey(
                        on_delete=models.deletion.CASCADE,
                        to="good_flow_delete_field_pending_with_not_null_m2m_app.othertable",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="TestTable",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                (
                    "excluded_projects",
                    models.ManyToManyField(
                        through="good_flow_delete_field_pending_with_not_null_m2m_app.M2MTable",
                        to="good_flow_delete_field_pending_with_not_null_m2m_app.othertable",
                    ),
                ),
            ],
        ),
        migrations.AddField(
            model_name="m2mtable",
            name="test_table",
            field=FlexibleForeignKey(
                on_delete=models.deletion.CASCADE,
                to="good_flow_delete_field_pending_with_not_null_m2m_app.testtable",
            ),
        ),
    ]
