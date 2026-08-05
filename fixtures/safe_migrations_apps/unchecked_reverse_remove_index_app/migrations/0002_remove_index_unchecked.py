from django.db import migrations

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    checked = False

    dependencies = [
        ("unchecked_reverse_remove_index_app", "0001_initial"),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name="testtable",
            name="test_unchecked_name_idx",
        ),
    ]
