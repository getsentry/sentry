from django.db import migrations

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):

    dependencies = [
        ("run_sql_app", "0001_initial"),
    ]
    allow_run_sql = True

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    """ALTER TABLE "run_sql_app_testtable" DROP COLUMN "field";""",
                    reverse_sql="""ALTER TABLE "run_sql_app_testtable" ADD COLUMN "field" int NULL;""",
                    hints={"tables": ["run_sql_app_testtable"]},
                )
            ],
            state_operations=[migrations.RemoveField("testtable", "field")],
        )
    ]
