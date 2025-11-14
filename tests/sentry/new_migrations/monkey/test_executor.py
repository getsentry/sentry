from typing import int
from collections.abc import Generator
from unittest.mock import patch

import pytest
from django.apps import AppConfig, apps
from django.conf import settings
from django.contrib.postgres.operations import BtreeGistExtension
from django.db import migrations, models

from sentry.new_migrations.monkey.executor import (
    MissingDatabaseRoutingInfo,
    SentryMigrationExecutor,
    _check_bitfield_flags,
)
from sentry.new_migrations.monkey.special import SafeRunSQL


class DummyGetsentryAppConfig(AppConfig):
    name = "getsentry"
    label = "getsentry"
    verbose_name = "Dummy Getsentry App"
    path = "/tmp/dummy_getsentry"


class TestSentryMigrationExecutor:
    @pytest.fixture(autouse=True)
    def _mock_getsentry_if_not_registered(self) -> Generator[None]:
        if "getsentry" in settings.INSTALLED_APPS:
            yield
            return

        with (
            patch.dict(apps.app_configs, {"getsentry": DummyGetsentryAppConfig("getsentry", None)}),
            patch.object(settings, "INSTALLED_APPS", new=settings.INSTALLED_APPS + ("getsentry",)),
        ):
            yield

    def test_check_db_routing_pass(self) -> None:
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
                SafeRunSQL(
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
        SentryMigrationExecutor._check_db_routing(TestMigration(name="test", app_label="uptime"))

    def test_check_db_routing_pass_2(self) -> None:
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
                        SafeRunSQL(
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
        SentryMigrationExecutor._check_db_routing(TestMigration(name="test", app_label="uptime"))

    def test_check_db_routing_missing_hints(self) -> None:
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
                        SafeRunSQL("TEST SQL"),
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
        with pytest.raises(MissingDatabaseRoutingInfo):
            SentryMigrationExecutor._check_db_routing(
                TestMigration(name="test", app_label="uptime")
            )

    def test_check_db_routing_missing_hints_2(self) -> None:
        class TestMigration(migrations.Migration):
            operations = [
                SafeRunSQL("TEST SQL"),
            ]

        with pytest.raises(MissingDatabaseRoutingInfo):
            SentryMigrationExecutor._check_db_routing(
                TestMigration(name="test", app_label="getsentry")
            )
        with pytest.raises(MissingDatabaseRoutingInfo):
            SentryMigrationExecutor._check_db_routing(
                TestMigration(name="test", app_label="uptime")
            )

    def test_check_db_routing_missing_hints_3(self) -> None:
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

        with pytest.raises(MissingDatabaseRoutingInfo):
            SentryMigrationExecutor._check_db_routing(
                TestMigration(name="test", app_label="uptime")
            )

    def test_check_db_routing_dont_run_for_3rd_party(self) -> None:
        class TestMigration(migrations.Migration):
            operations = [
                SafeRunSQL("TEST SQL"),
            ]

        SentryMigrationExecutor._check_db_routing(TestMigration(name="test", app_label="auth"))

    def test_check_db_routing_extensions(self) -> None:
        class TestMigration(migrations.Migration):
            operations = [BtreeGistExtension()]

        SentryMigrationExecutor._check_db_routing(TestMigration(name="test", app_label="sentry"))
        SentryMigrationExecutor._check_db_routing(TestMigration(name="test", app_label="uptime"))


@pytest.mark.parametrize(
    ("before", "after"),
    (
        pytest.param(["a", "b", "c"], ["a", "b", "c"], id="noop"),
        pytest.param(["a", "b", "c"], ["a", "b", "c", "d"], id="append"),
    ),
)
def test_check_bitfield_flags_ok(before: list[str], after: list[str]) -> None:
    _check_bitfield_flags("001_migration", before, after)


def test_check_bitfield_flags_deletion() -> None:
    expected = """\
migration `001_migration` alters a BitField in an unsafe way!

the following flags were removed: b

unused flags must remain to preserve padding for future flags
""".rstrip()
    with pytest.raises(ValueError) as excinfo:
        _check_bitfield_flags("001_migration", ["a", "b", "c"], ["a", "c"])
    (msg,) = excinfo.value.args
    assert msg == expected


def test_check_bitfield_flags_insertion() -> None:
    expected = """\
migration `001_migration` alters a BitField in an unsafe way!

the following flags were inserted between old flags: d

new flags must be added at the end or flags will change meaning
""".rstrip()
    with pytest.raises(ValueError) as excinfo:
        _check_bitfield_flags("001_migration", ["a", "b", "c"], ["a", "d", "b", "c"])
    (msg,) = excinfo.value.args
    assert msg == expected


def test_check_bitfield_flags_reorder() -> None:
    expected = """\
migration `001_migration` alters a BitField in an unsafe way!

the following old flags were reordered:

--- old
+++ new
@@ -1,3 +1,3 @@
+b
 a
-b
 c

flags must retain historical order or flags will change meaning
""".rstrip()
    with pytest.raises(ValueError) as excinfo:
        _check_bitfield_flags("001_migration", ["a", "b", "c"], ["b", "a", "c"])
    (msg,) = excinfo.value.args
    assert msg == expected
