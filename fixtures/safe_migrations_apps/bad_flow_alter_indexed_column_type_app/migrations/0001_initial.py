from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.special import SafeRunSQL

TABLE = "bad_flow_alter_indexed_column_type_app_testtable"
INDEX = "testtable_field_idx"


class Migration(CheckedMigration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="TestTable",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("field", models.CharField(max_length=100)),
            ],
        ),
        # Create the index with plain (non-concurrent) CREATE INDEX so the fixture can
        # run inside the transaction that wraps TestCase. Production migrations must
        # still use AddIndex/AddConstraint, which dzdm rewrites to CONCURRENTLY.
        SafeRunSQL(
            sql=f'CREATE INDEX "{INDEX}" ON "{TABLE}" ("field")',
            reverse_sql=f'DROP INDEX "{INDEX}"',
            hints={"tables": [TABLE]},
        ),
    ]
