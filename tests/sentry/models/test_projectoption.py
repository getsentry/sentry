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

    def test_cached_reads_outside_transactions(self) -> None:
        ProjectOption.objects.set_value(self.project, "foo", "bar")
        connection = transaction.get_connection(router.db_for_write(ProjectOption))
        with patch.object(connection, "ensure_connection") as ensure_connection:
            assert self.project.get_option("foo") == "bar"
            ensure_connection.assert_not_called()

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

    def test_update_publishes_only_after_commit(self) -> None:
        with patch("sentry.tasks.relay.schedule_invalidate_project_config") as invalidate:
            with transaction.atomic(using=self.using):
                assert self.manager.set_value(self.project.id, "foo", "new") is True
                assert self.project.get_option("foo") == "new"
                assert cache.get(self.cache_key)["foo"] == "old"
                assert self.cache_key not in self.manager._option_cache
                invalidate.assert_not_called()

            assert cache.get(self.cache_key)["foo"] == "new"
            assert self.manager._option_cache[self.cache_key]["foo"] == "new"
            invalidate.assert_called_once_with(
                project_id=self.project.id,
                trigger="projectoption.set_value",
                trigger_details="foo",
                transaction_db=self.using,
            )

    def test_update_rollback(self) -> None:
        with patch("sentry.tasks.relay.schedule_invalidate_project_config") as invalidate:
            with pytest.raises(ValueError, match="rollback"):
                with transaction.atomic(using=self.using):
                    self.manager.set_value(self.project, "foo", "new")
                    assert self.project.get_option("foo") == "new"
                    raise ValueError("rollback")

        assert self.manager.get(project=self.project, key="foo").value == "old"
        assert cache.get(self.cache_key)["foo"] == "old"
        assert self.project.get_option("foo") == "old"
        invalidate.assert_not_called()

    def test_create_rollback_including_post_save(self) -> None:
        with pytest.raises(ValueError, match="rollback"):
            with transaction.atomic(using=self.using):
                self.manager.set_value(self.project, "new-option", "new")
                assert self.project.get_option("new-option") == "new"
                assert "new-option" not in cache.get(self.cache_key)
                raise ValueError("rollback")

        assert not self.manager.filter(project=self.project, key="new-option").exists()
        assert self.project.get_option("new-option") is None
        assert "new-option" not in cache.get(self.cache_key)

    def test_create_commit(self) -> None:
        with transaction.atomic(using=self.using):
            self.manager.set_value(self.project, "new-option", "new")
            assert "new-option" not in cache.get(self.cache_key)

        assert cache.get(self.cache_key)["new-option"] == "new"
        assert self.project.get_option("new-option") == "new"

    def test_nested_rollback_reloads_committed_state(self) -> None:
        with transaction.atomic(using=self.using):
            self.manager.set_value(self.project, "foo", "outer")
            with pytest.raises(ValueError, match="rollback"):
                with transaction.atomic(using=self.using):
                    self.manager.set_value(self.project, "foo", "inner")
                    self.manager.set_value(self.project, "rolled-back-option", True)
                    raise ValueError("rollback")
            assert self.project.get_option("foo") == "outer"
            assert self.project.get_option("rolled-back-option") is None
            self.manager.set_value(self.project, "another-option", True)
            assert cache.get(self.cache_key)["foo"] == "old"

        assert cache.get(self.cache_key)["foo"] == "outer"
        assert cache.get(self.cache_key)["another-option"] is True
        assert "rolled-back-option" not in cache.get(self.cache_key)

    def test_cold_read_does_not_publish_uncommitted_data(self) -> None:
        with pytest.raises(ValueError, match="rollback"):
            with transaction.atomic(using=self.using):
                self.manager.set_value(self.project, "foo", "new")
                cache.delete(self.cache_key)
                self.manager.clear_local_cache()
                assert self.project.get_option("foo") == "new"
                assert cache.get(self.cache_key) is None
                assert self.cache_key not in self.manager._option_cache
                raise ValueError("rollback")

        assert self.project.get_option("foo") == "old"
        assert cache.get(self.cache_key)["foo"] == "old"

    def test_save_signal_rollback(self) -> None:
        option = self.manager.get(project=self.project, key="foo")
        with pytest.raises(ValueError, match="rollback"):
            with transaction.atomic(using=self.using):
                option.value = "new"
                option.save()
                assert cache.get(self.cache_key)["foo"] == "old"
                raise ValueError("rollback")

        assert self.project.get_option("foo") == "old"

    def test_unset_rollback_including_post_delete(self) -> None:
        with pytest.raises(ValueError, match="rollback"):
            with transaction.atomic(using=self.using):
                self.manager.unset_value(self.project, "foo")
                assert self.project.get_option("foo") is None
                assert cache.get(self.cache_key)["foo"] == "old"
                raise ValueError("rollback")

        assert self.project.get_option("foo") == "old"

    def test_noop_does_not_reload(self) -> None:
        with patch.object(self.manager, "reload_cache") as reload:
            with transaction.atomic(using=self.using):
                assert self.manager.set_value(self.project, "foo", "old") is False
            reload.assert_not_called()

    def test_bound_manager_uses_its_database(self) -> None:
        manager = self.manager.db_manager(self.using)
        with transaction.atomic(using=self.using):
            with patch("django.db.router.db_for_write", wraps=router.db_for_write) as db_for_write:
                manager.set_value(self.project, "new-option", "new")
                assert manager.get_value(self.project, "new-option") == "new"
                assert all(
                    call.args[0] is not ProjectOption for call in db_for_write.call_args_list
                )
            assert "new-option" not in cache.get(self.cache_key)

        assert cache.get(self.cache_key)["new-option"] == "new"

    def test_manual_transaction_commit(self) -> None:
        connection = transaction.get_connection(self.using)
        connection.set_autocommit(False)
        try:
            self.manager.set_value(self.project, "foo", "new")
            assert self.project.get_option("foo") == "new"
            assert cache.get(self.cache_key)["foo"] == "old"
            connection.commit()
            connection.set_autocommit(True)
        finally:
            connection.rollback()
            connection.set_autocommit(True)

        assert cache.get(self.cache_key)["foo"] == "new"

    def test_manual_transaction_rollback(self) -> None:
        connection = transaction.get_connection(self.using)
        connection.set_autocommit(False)
        try:
            self.manager.set_value(self.project, "foo", "new")
            assert self.project.get_option("foo") == "new"
        finally:
            connection.rollback()
            connection.set_autocommit(True)

        assert cache.get(self.cache_key)["foo"] == "old"
        assert self.project.get_option("foo") == "old"
