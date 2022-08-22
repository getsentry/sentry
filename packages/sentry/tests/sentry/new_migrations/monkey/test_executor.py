import pytest
from django.db import migrations, models

from sentry.new_migrations.monkey.executor import (
    MissingDatabaseRoutingInfo,
    SentryMigrationExecutor,
)
from sentry.testutils import TestCase


class SentryMigrationExecutorTest(TestCase):
    def test_check_db_routing_pass(self):
        class TestMigration(migrations.Migration):
            operations = [
                migrations.CreateModel(
                    name="Test",
                    fields=[
                        (
                            "id",
                            models.IntegerField(serialize=False, primary_key=True),
                        ),
                        (
                            "type",
                            models.IntegerField(
                                choices=[
                                    (1, "set_resolved"),
                                ]
                            ),
                        ),
                    ],
                    options={"db_table": "sentry_test"},
                ),
                migrations.AlterUniqueTogether(
                    name="test", unique_together={("project_id", "key", "value")}
                ),
                migrations.AddField(
                    model_name="release",
                    name="projects",
                    field=models.ManyToManyField(related_name="releases", to="sentry.Project"),
                ),
                migrations.RunSQL(
                    "TEST SQL",
                    hints={"tables": ["sentry_savedsearch"]},
                ),
                migrations.RunPython(
                    migrations.RunPython.noop,
                    migrations.RunPython.noop,
                    hints={"tables": ["sentry_test"]},
                ),
            ]

        SentryMigrationExecutor._check_db_routing(TestMigration(name="test", app_label="sentry"))

        class TestMigration(migrations.Migration):
            operations = [
                migrations.SeparateDatabaseAndState(
                    state_operations=[],
                    database_operations=[
                        migrations.CreateModel(
                            name="Test",
                            fields=[
                                (
                                    "id",
                                    models.IntegerField(serialize=False, primary_key=True),
                                ),
                                (
                                    "type",
                                    models.IntegerField(
                                        choices=[
                                            (1, "set_resolved"),
                                        ]
                                    ),
                                ),
                            ],
                            options={"db_table": "sentry_test"},
                        ),
                        migrations.AlterUniqueTogether(
                            name="test", unique_together={("project_id", "key", "value")}
                        ),
                        migrations.AddField(
                            model_name="release",
                            name="projects",
                            field=models.ManyToManyField(
                                related_name="releases", to="sentry.Project"
                            ),
                        ),
                        migrations.RunSQL(
                            "TEST SQL",
                            hints={"tables": ["sentry_savedsearch"]},
                        ),
                        migrations.RunPython(
                            migrations.RunPython.noop,
                            migrations.RunPython.noop,
                            hints={"tables": ["sentry_test"]},
                        ),
                    ],
                ),
            ]

        SentryMigrationExecutor._check_db_routing(TestMigration(name="test", app_label="sentry"))

    def test_check_db_routing_missing_hints(self):
        class TestMigration(migrations.Migration):
            operations = [
                migrations.SeparateDatabaseAndState(
                    state_operations=[],
                    database_operations=[
                        migrations.AlterUniqueTogether(
                            name="test", unique_together={("project_id", "key", "value")}
                        ),
                        migrations.AddField(
                            model_name="release",
                            name="projects",
                            field=models.ManyToManyField(
                                related_name="releases", to="sentry.Project"
                            ),
                        ),
                        migrations.RunSQL("TEST SQL"),
                        migrations.RunPython(
                            migrations.RunPython.noop,
                            migrations.RunPython.noop,
                            hints={"tables": ["sentry_test"]},
                        ),
                    ],
                ),
            ]

        with pytest.raises(MissingDatabaseRoutingInfo):
            SentryMigrationExecutor._check_db_routing(
                TestMigration(name="test", app_label="sentry")
            )

        class TestMigration(migrations.Migration):
            operations = [
                migrations.RunSQL("TEST SQL"),
            ]

        with pytest.raises(MissingDatabaseRoutingInfo):
            SentryMigrationExecutor._check_db_routing(
                TestMigration(name="test", app_label="getsentry")
            )

        class TestMigration(migrations.Migration):
            operations = [
                migrations.RunPython(
                    migrations.RunPython.noop,
                    migrations.RunPython.noop,
                ),
            ]

        with pytest.raises(MissingDatabaseRoutingInfo):
            SentryMigrationExecutor._check_db_routing(
                TestMigration(name="test", app_label="getsentry")
            )

    def test_check_db_routing_dont_run_for_3rd_party(self):
        class TestMigration(migrations.Migration):
            operations = [
                migrations.RunSQL("TEST SQL"),
            ]

        SentryMigrationExecutor._check_db_routing(TestMigration(name="test", app_label="auth"))
