from unittest.mock import patch

from sentry.seer.similarity.config import (
    SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE,
    SEER_GROUPING_NEW_VERSION,
    SEER_GROUPING_STABLE_VERSION,
    get_grouping_model_version,
    get_new_model_version,
    is_new_model_rolled_out,
    should_send_new_model_embeddings,
)
from sentry.seer.similarity.types import GroupingVersion
from sentry.testutils.cases import TestCase


class GetGroupingModelVersionTest(TestCase):
    def test_returns_stable_when_rollout_disabled(self):
        """When new model rollout is disabled, return stable version"""
        with patch("sentry.seer.similarity.config.SEER_GROUPING_NEW_VERSION", None):
            result = get_grouping_model_version(self.project)
            assert result == SEER_GROUPING_STABLE_VERSION

    def test_returns_stable_when_feature_not_enabled(self):
        """When feature flag is not enabled for project, return stable version"""
        result = get_grouping_model_version(self.project)
        assert result == SEER_GROUPING_STABLE_VERSION

    def test_returns_new_when_feature_enabled(self):
        """When feature flag is enabled for project, return new version"""
        with self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE):
            result = get_grouping_model_version(self.project)
            assert result == SEER_GROUPING_NEW_VERSION


class IsNewModelRolledOutTest(TestCase):
    def test_returns_false_when_no_new_version(self):
        """When no new version is configured, rollout is not active"""
        with patch("sentry.seer.similarity.config.SEER_GROUPING_NEW_VERSION", None):
            result = is_new_model_rolled_out(self.project)
            assert result is False

    def test_returns_false_when_feature_not_enabled(self):
        """When feature flag is not enabled, rollout is not active for project"""
        result = is_new_model_rolled_out(self.project)
        assert result is False

    def test_returns_true_when_feature_enabled(self):
        """When feature flag is enabled, rollout is active for project"""
        with self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE):
            result = is_new_model_rolled_out(self.project)
            assert result is True


class GetNewModelVersionTest(TestCase):
    def test_returns_configured_version(self):
        """Returns the configured new model version"""
        result = get_new_model_version()
        assert result == GroupingVersion.V2

    def test_returns_none_when_disabled(self):
        """Returns None when rollout is disabled"""
        with patch("sentry.seer.similarity.config.SEER_GROUPING_NEW_VERSION", None):
            result = get_new_model_version()
            assert result is None


class ShouldSendNewModelEmbeddingsTest(TestCase):
    def test_returns_false_when_no_rollout(self):
        """Returns False when no new version is being rolled out"""
        with patch("sentry.seer.similarity.config.SEER_GROUPING_NEW_VERSION", None):
            result = should_send_new_model_embeddings(self.project, None)
            assert result is False

    def test_returns_false_when_feature_not_enabled(self):
        """Returns False when feature flag is not enabled for project"""
        result = should_send_new_model_embeddings(self.project, None)
        assert result is False

    def test_returns_true_when_no_metadata(self):
        """Returns True when grouphash has no metadata (never sent to Seer)"""
        with self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE):
            result = should_send_new_model_embeddings(self.project, None)
            assert result is True

    def test_returns_true_when_metadata_not_new_version(self):
        """Returns True when grouphash was sent to Seer but not with new version"""
        with self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE):
            result = should_send_new_model_embeddings(self.project, "v1")
            assert result is True

    def test_returns_false_when_already_sent_to_new_version(self):
        """Returns False when grouphash was already sent to new version"""
        with self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE):
            result = should_send_new_model_embeddings(self.project, "v2")
            assert result is False
