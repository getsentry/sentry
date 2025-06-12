from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):

    dependencies = [
        ("bad_flow_long_index_app", "0001_initial"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="testtable",
            index=models.Index(
                fields=["name"],
                name="this_is_a_very_long_index_name_that_exceeds_the_postgresql_limit_of_sixty_three_bytes_and_should_fail",
            ),
        ),
    ]
