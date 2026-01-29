from typing import TypedDict
from unittest.mock import patch

from fixtures.seer.webhooks import MOCK_GROUP_ID, MOCK_RUN_ID
from sentry.seer.entrypoints.cache import AUTOFIX_CACHE_TIMEOUT_SECONDS, SeerOperatorAutofixCache
from sentry.seer.entrypoints.types import SeerEntrypointKey
from sentry.testutils.cases import TestCase


class MockCachePayload(TypedDict):
    thread_id: str


class SeerOperatorAutofixCacheTest(TestCase):
    def setUp(self):
        self.entrypoint_key = str(SeerEntrypointKey.SLACK)
        self.pre_cache_key = SeerOperatorAutofixCache._get_pre_autofix_cache_key(
            entrypoint_key=self.entrypoint_key, group_id=MOCK_GROUP_ID
        )
        self.post_cache_key = SeerOperatorAutofixCache._get_post_autofix_cache_key(
            entrypoint_key=self.entrypoint_key, run_id=MOCK_RUN_ID
        )

    def test_get_pre_autofix_cache_key(self):
        assert self.pre_cache_key == f"seer:pre_autofix:{self.entrypoint_key}:{MOCK_GROUP_ID}"

    def test_get_post_autofix_cache_key(self):
        assert self.post_cache_key == f"seer:post_autofix:{self.entrypoint_key}:{MOCK_RUN_ID}"

    @patch("sentry.seer.entrypoints.cache.cache.set")
    def test_populate_pre_autofix_cache(self, mock_cache_set):
        pre_cache_payload = MockCachePayload(thread_id="pre_cache_payload")
        result = SeerOperatorAutofixCache.populate_pre_autofix_cache(
            entrypoint_key=self.entrypoint_key,
            cache_payload=pre_cache_payload,
            group_id=MOCK_GROUP_ID,
        )
        mock_cache_set.assert_called_once_with(
            self.pre_cache_key,
            pre_cache_payload,
            timeout=AUTOFIX_CACHE_TIMEOUT_SECONDS,
        )
        assert result["key"] == self.pre_cache_key
        assert result["source"] == "group_id"
        assert result["payload"] == pre_cache_payload

    @patch("sentry.seer.entrypoints.cache.cache.set")
    def test_populate_post_autofix_cache(self, mock_cache_set):
        post_cache_payload = MockCachePayload(thread_id="post_cache_payload")
        result = SeerOperatorAutofixCache.populate_post_autofix_cache(
            entrypoint_key=self.entrypoint_key,
            cache_payload=post_cache_payload,
            run_id=MOCK_RUN_ID,
        )
        mock_cache_set.assert_called_once_with(
            self.post_cache_key,
            post_cache_payload,
            timeout=AUTOFIX_CACHE_TIMEOUT_SECONDS,
        )
        assert result["key"] == self.post_cache_key
        assert result["source"] == "run_id"
        assert result["payload"] == post_cache_payload

    @patch("sentry.seer.entrypoints.cache.cache.get")
    def test_get_pre_autofix_cache(self, mock_cache_get):
        pre_cache_payload = MockCachePayload(thread_id="pre_cache_payload")
        mock_cache_get.return_value = pre_cache_payload

        result = SeerOperatorAutofixCache._get_pre_autofix_cache(
            entrypoint_key=self.entrypoint_key, group_id=MOCK_GROUP_ID
        )

        mock_cache_get.assert_called_once_with(self.pre_cache_key)
        assert result is not None
        assert result["key"] == self.pre_cache_key
        assert result["source"] == "group_id"
        assert result["payload"] == pre_cache_payload

    @patch("sentry.seer.entrypoints.cache.cache.get")
    def test_get_pre_autofix_cache_miss(self, mock_cache_get):
        mock_cache_get.return_value = None

        result = SeerOperatorAutofixCache._get_pre_autofix_cache(
            entrypoint_key=self.entrypoint_key, group_id=MOCK_GROUP_ID
        )

        assert result is None

    @patch("sentry.seer.entrypoints.cache.cache.get")
    def test_get_post_autofix_cache(self, mock_cache_get):
        post_cache_payload = MockCachePayload(thread_id="post_cache_payload")
        mock_cache_get.return_value = post_cache_payload

        result = SeerOperatorAutofixCache._get_post_autofix_cache(
            entrypoint_key=self.entrypoint_key, run_id=MOCK_RUN_ID
        )

        mock_cache_get.assert_called_once_with(self.post_cache_key)
        assert result is not None
        assert result["key"] == self.post_cache_key
        assert result["source"] == "run_id"
        assert result["payload"] == post_cache_payload

    @patch("sentry.seer.entrypoints.cache.cache.get")
    def test_get_post_autofix_cache_miss(self, mock_cache_get):
        mock_cache_get.return_value = None

        result = SeerOperatorAutofixCache._get_post_autofix_cache(
            entrypoint_key=self.entrypoint_key, run_id=MOCK_RUN_ID
        )

        assert result is None

    @patch("sentry.seer.entrypoints.cache.cache.delete")
    @patch("sentry.seer.entrypoints.cache.cache.get")
    def test_get_prefers_post_cache_and_deletes_pre_cache(self, mock_cache_get, mock_cache_delete):
        pre_cache_payload = MockCachePayload(thread_id="pre_cache_payload")
        post_cache_payload = MockCachePayload(thread_id="post_cache_payload")
        mock_cache_get.side_effect = lambda k: (
            post_cache_payload if k == self.post_cache_key else pre_cache_payload
        )

        result = SeerOperatorAutofixCache.get(
            entrypoint_key=self.entrypoint_key, group_id=MOCK_GROUP_ID, run_id=MOCK_RUN_ID
        )

        assert result is not None
        assert result["source"] == "run_id"
        assert result["payload"] == post_cache_payload
        mock_cache_delete.assert_called_once_with(self.pre_cache_key)

    @patch("sentry.seer.entrypoints.cache.cache.delete")
    @patch("sentry.seer.entrypoints.cache.cache.get")
    def test_get_falls_back_to_pre_cache(self, mock_cache_get, mock_cache_delete):
        pre_cache_payload = MockCachePayload(thread_id="pre_cache_payload")
        mock_cache_get.side_effect = lambda k: (
            pre_cache_payload if k == self.pre_cache_key else None
        )

        result = SeerOperatorAutofixCache.get(
            entrypoint_key=self.entrypoint_key, group_id=MOCK_GROUP_ID, run_id=MOCK_RUN_ID
        )

        assert result is not None
        assert result["source"] == "group_id"
        assert result["payload"] == pre_cache_payload
        mock_cache_delete.assert_not_called()

    @patch("sentry.seer.entrypoints.cache.cache.get")
    def test_get_all_cache_miss(self, mock_cache_get):
        mock_cache_get.return_value = None

        result = SeerOperatorAutofixCache.get(
            entrypoint_key=self.entrypoint_key, group_id=MOCK_GROUP_ID, run_id=MOCK_RUN_ID
        )

        assert result is None


class SeerOperatorAutofixCacheMigrateTest(TestCase):
    def setUp(self):
        self.entrypoint_key = str(SeerEntrypointKey.SLACK)
        self.pre_cache_key = SeerOperatorAutofixCache._get_pre_autofix_cache_key(
            entrypoint_key=self.entrypoint_key, group_id=MOCK_GROUP_ID
        )
        self.post_cache_key = SeerOperatorAutofixCache._get_post_autofix_cache_key(
            entrypoint_key=self.entrypoint_key, run_id=MOCK_RUN_ID
        )

    @patch.dict(
        "sentry.seer.entrypoints.cache.entrypoint_registry.registrations",
        {SeerEntrypointKey.SLACK: None},
    )
    @patch("sentry.seer.entrypoints.cache.cache")
    def test_migrate(self, mock_cache):
        pre_cache_payload = MockCachePayload(thread_id="pre_cache_payload")
        mock_cache.get.side_effect = lambda k: (
            pre_cache_payload if k == self.pre_cache_key else None
        )
        SeerOperatorAutofixCache.migrate(from_group_id=MOCK_GROUP_ID, to_run_id=MOCK_RUN_ID)
        mock_cache.set.assert_called_once_with(
            self.post_cache_key,
            pre_cache_payload,
            timeout=AUTOFIX_CACHE_TIMEOUT_SECONDS,
        )
        mock_cache.delete.assert_called_once_with(self.pre_cache_key)

    @patch.dict(
        "sentry.seer.entrypoints.cache.entrypoint_registry.registrations",
        {SeerEntrypointKey.SLACK: None},
    )
    @patch("sentry.seer.entrypoints.cache.cache")
    def test_migrate_full_miss(self, mock_cache):
        mock_cache.get.side_effect = lambda k: None
        SeerOperatorAutofixCache.migrate(from_group_id=MOCK_GROUP_ID, to_run_id=MOCK_RUN_ID)
        mock_cache.set.assert_not_called()

    @patch.dict(
        "sentry.seer.entrypoints.cache.entrypoint_registry.registrations",
        {SeerEntrypointKey.SLACK: None},
    )
    @patch("sentry.seer.entrypoints.cache.cache")
    def test_migrate_overwrite(self, mock_cache):
        pre_cache_payload = MockCachePayload(thread_id="pre_cache_payload")
        post_cache_payload = MockCachePayload(thread_id="post_cache_payload")
        mock_cache.get.side_effect = lambda k: (
            post_cache_payload if k == self.post_cache_key else pre_cache_payload
        )
        # No overwrite by default
        SeerOperatorAutofixCache.migrate(from_group_id=MOCK_GROUP_ID, to_run_id=MOCK_RUN_ID)
        mock_cache.set.assert_not_called()
        # With overwrite, the post cache should be set
        SeerOperatorAutofixCache.migrate(
            from_group_id=MOCK_GROUP_ID, to_run_id=MOCK_RUN_ID, overwrite=True
        )
        mock_cache.set.assert_called_once_with(
            self.post_cache_key,
            pre_cache_payload,
            timeout=AUTOFIX_CACHE_TIMEOUT_SECONDS,
        )
        mock_cache.delete.assert_called_once_with(self.pre_cache_key)
