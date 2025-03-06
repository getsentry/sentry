from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.special import SafeRunSQL


class Migration(CheckedMigration):

    dependencies = [
        ("safe_run_sql_app", "0001_initial"),
    ]
    allow_run_sql = True

    operations = [
        SafeRunSQL(
            """ALTER TABLE "safe_run_sql_app_testtable" DROP COLUMN IF EXISTS "field";""",
            reverse_sql="""ALTER TABLE "safe_run_sql_app_testtable" ADD COLUMN "field" int NULL;""",
            hints={"tables": ["safe_run_sql_app_testtable"]},
        ),
        migrations.AddField("testtable", "field", models.IntegerField(null=True)),
    ]
