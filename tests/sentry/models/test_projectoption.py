from collections.abc import Iterator
from unittest.mock import patch

import pytest
from django.db import connections, router, transaction

from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.hybrid_cloud import simulated_transaction_watermarks
from sentry.utils.cache import cache


class ProjectOptionManagerTest(TestCase):
    def test_set_value(self) -> None:
        ProjectOption.objects.set_value(self.project, "foo", "bar")
        assert ProjectOption.objects.get(project=self.project, key="foo").value == "bar"

    def test_get_value(self) -> None:
        result = ProjectOption.objects.get_value(self.project, "foo")
        assert result is None

        ProjectOption.objects.create(project=self.project, key="foo", value="bar")
        result = ProjectOption.objects.get_value(self.project, "foo")
        assert result == "bar"

    def test_unset_value(self) -> None:
        ProjectOption.objects.unset_value(self.project, "foo")
        ProjectOption.objects.create(project=self.project, key="foo", value="bar")
        ProjectOption.objects.unset_value(self.project, "foo")
        assert not ProjectOption.objects.filter(project=self.project, key="foo").exists()

    def test_get_value_bulk(self) -> None:
        result = ProjectOption.objects.get_value_bulk([self.project], "foo")
        assert result == {self.project: None}

        ProjectOption.objects.create(project=self.project, key="foo", value="bar")
        result = ProjectOption.objects.get_value_bulk([self.project], "foo")
        assert result == {self.project: "bar"}


class ProjectOptionCacheTest(TransactionTestCase):
    def test_reload_task_local_cache_takes_values_saved_by_another_process(self) -> None:
        ProjectOption.objects.set_value(self.project, "foo", "bar")
        cache_key = ProjectOption.objects._make_key(self.project.id)
        stale = ProjectOption.objects._option_cache[cache_key]

        # Another process saves a new value. The database and the shared cache
        # have it, but this process still holds the old value.
        ProjectOption.objects.set_value(self.project, "foo", "baz")
        ProjectOption.objects._option_cache[cache_key] = stale
        assert ProjectOption.objects.get_value(self.project, "foo") == "bar"

        ProjectOption.objects.reload_task_local_cache(self.project.id)

        assert ProjectOption.objects.get_value(self.project, "foo") == "baz"

    def test_reload_task_local_cache_without_shared_cache_reads_the_database(self) -> None:
        ProjectOption.objects.set_value(self.project, "foo", "bar")
        cache_key = ProjectOption.objects._make_key(self.project.id)
        stale = ProjectOption.objects._option_cache[cache_key]

        ProjectOption.objects.set_value(self.project, "foo", "baz")
        ProjectOption.objects._option_cache[cache_key] = stale
        cache.delete(cache_key)

        ProjectOption.objects.reload_task_local_cache(self.project.id)

        assert ProjectOption.objects.get_value(self.project, "foo") == "baz"


class ProjectOptionTransactionTest(TransactionTestCase):
    @pytest.fixture(autouse=True)
    def disable_simulated_commits(self) -> Iterator[None]:
        # Use real commits, including when autocommit is managed manually.
        with (
            patch.dict(
                simulated_transaction_watermarks.state, {alias: -1 for alias in connections}
            ),
            in_test_hide_transaction_boundary(),
        ):
            yield

    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project(organization=self.create_organization(), teams=[])
        self.manager = ProjectOption.objects
        self.using = router.db_for_write(ProjectOption)
        self.cache_key = self.manager._make_key(self.project.id)
        self.manager.set_value(self.project, "foo", "old")

    def test_cache_updates_after_commit(self) -> None:
        before = cache.get(self.cache_key)
        expected = before | {"foo": "new", "created": True}
        with transaction.atomic(using=self.using):
            self.manager.set_value(self.project, "foo", "new")
            self.manager.set_value(self.project, "created", True)
            assert self.manager.get_all_values(self.project) == expected
            assert cache.get(self.cache_key) == before

        assert cache.get(self.cache_key) == expected
        assert self.manager.get_all_values(self.project) == expected

    def test_rollback_preserves_cached_options(self) -> None:
        before = cache.get(self.cache_key)
        with transaction.atomic(using=self.using):
            self.manager.set_value(self.project, "foo", "new")
            self.manager.set_value(self.project, "created", True)
            assert cache.get(self.cache_key) == before
            transaction.set_rollback(True, using=self.using)

        assert cache.get(self.cache_key) == before
        assert self.manager.get_all_values(self.project) == before

    def test_nested_rollback_reloads_committed_state(self) -> None:
        with transaction.atomic(using=self.using):
            self.manager.set_value(self.project, "foo", "outer")
            with transaction.atomic(using=self.using):
                self.manager.set_value(self.project, "foo", "inner")
                self.manager.set_value(self.project, "rolled-back-option", True)
                transaction.set_rollback(True, using=self.using)
            assert self.project.get_option("foo") == "outer"
            assert cache.get(self.cache_key)["foo"] == "old"

        assert cache.get(self.cache_key)["foo"] == "outer"
        assert "rolled-back-option" not in cache.get(self.cache_key)

    def test_cold_read_does_not_publish_uncommitted_data(self) -> None:
        with transaction.atomic(using=self.using):
            self.manager.set_value(self.project, "foo", "new")
            cache.delete(self.cache_key)
            self.manager.clear_local_cache()
            assert self.project.get_option("foo") == "new"
            assert cache.get(self.cache_key) is None
            assert self.cache_key not in self.manager._option_cache
            transaction.set_rollback(True, using=self.using)

        assert self.project.get_option("foo") == "old"
        assert cache.get(self.cache_key)["foo"] == "old"

    def test_manual_transactions(self) -> None:
        connection = transaction.get_connection(self.using)
        connection.set_autocommit(False)
        try:
            self.manager.set_value(self.project, "foo", "committed")
            assert cache.get(self.cache_key)["foo"] == "old"
            connection.commit()
            connection.set_autocommit(True)
            assert cache.get(self.cache_key)["foo"] == "committed"

            connection.set_autocommit(False)
            self.manager.set_value(self.project, "foo", "rolled-back")
            assert self.project.get_option("foo") == "rolled-back"
            assert cache.get(self.cache_key)["foo"] == "committed"
        finally:
            connection.rollback()
            connection.set_autocommit(True)

        assert cache.get(self.cache_key)["foo"] == "committed"
        assert self.project.get_option("foo") == "committed"
