from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):

    dependencies = [
        ("bad_flow_long_identifier_app", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="testtable",
            name="this_is_a_very_long_field_name_that_exceeds_the_postgresql_limit_of_sixty_three_bytes_and_should_fail",
            field=models.IntegerField(null=True),
        ),
    ]
