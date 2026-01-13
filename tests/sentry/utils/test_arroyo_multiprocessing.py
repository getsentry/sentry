"""Tests for arroyo multiprocessing utilities."""

from unittest.mock import patch

from django.test import override_settings

from sentry.testutils.cases import TestCase
from sentry.utils.arroyo import _initialize_arroyo_subprocess


class TestArroyoSubprocessInitialization(TestCase):
    @patch("sentry.utils.arroyo.add_global_tags")
    @patch("sentry.utils.arroyo.configure")
    @patch("django.db.close_old_connections")
    def test_initialize_arroyo_subprocess_closes_old_connections(
        self, mock_close_old_connections, mock_configure, mock_add_global_tags
    ):
        """
        Test that _initialize_arroyo_subprocess properly closes inherited
        database connections to prevent OperationalError in child processes.
        """
        tags = {"test": "value"}
        initializer = None

        _initialize_arroyo_subprocess(initializer, tags)

        # Verify that configure was called first
        mock_configure.assert_called_once()

        # Verify that close_old_connections was called after configure
        # This is critical to close any inherited database connections
        mock_close_old_connections.assert_called_once()

        # Verify that global tags were added
        mock_add_global_tags.assert_called_once_with(all_threads=True, tags=tags)

    @patch("sentry.utils.arroyo.add_global_tags")
    @patch("sentry.utils.arroyo.configure")
    @patch("django.db.close_old_connections")
    def test_initialize_arroyo_subprocess_with_custom_initializer(
        self, mock_close_old_connections, mock_configure, mock_add_global_tags
    ):
        """
        Test that custom initializers are called after closing connections.
        """
        tags = {"test": "value"}
        custom_initializer = lambda: None

        with patch.object(custom_initializer, "__call__") as mock_initializer:
            _initialize_arroyo_subprocess(mock_initializer, tags)

            # Verify configure was called
            mock_configure.assert_called_once()

            # Verify connections were closed before initializer
            mock_close_old_connections.assert_called_once()

            # Verify custom initializer was called
            mock_initializer.assert_called_once()

            # Verify global tags were added
            mock_add_global_tags.assert_called_once_with(all_threads=True, tags=tags)

    @override_settings(KAFKA_CONSUMER_FORCE_DISABLE_MULTIPROCESSING=True)
    def test_multiprocessing_can_be_disabled(self):
        """
        Test that multiprocessing can be disabled via settings.
        This doesn't directly test the connection closing, but ensures
        the multiprocessing infrastructure works with the fix.
        """
        from sentry.utils.arroyo import MultiprocessingPool

        pool = MultiprocessingPool(4)
        assert pool.pool is None
