from unittest.mock import patch

from sentry.preprod.quotas import should_run_distribution, should_run_size
from sentry.testutils.cases import TestCase


class ShouldRunSizeTest(TestCase):
    def setUp(self):
        super().setUp()
        self.artifact = self.create_preprod_artifact(project=self.project)

    @patch("sentry.preprod.quotas.has_size_quota", return_value=True)
    def test_returns_true_when_enabled_by_default(self, mock_quota):
        result, reason = should_run_size(self.artifact)
        assert result is True
        assert reason is None

    @patch("sentry.preprod.quotas.has_size_quota", return_value=True)
    def test_returns_false_when_disabled(self, mock_quota):
        self.project.update_option("sentry:preprod_size_enabled_by_customer", False)
        result, reason = should_run_size(self.artifact)
        assert result is False
        assert reason == "disabled"

    @patch("sentry.preprod.quotas.has_size_quota", return_value=True)
    def test_returns_true_when_explicitly_enabled(self, mock_quota):
        self.project.update_option("sentry:preprod_size_enabled_by_customer", True)
        result, reason = should_run_size(self.artifact)
        assert result is True
        assert reason is None

    @patch("sentry.preprod.quotas.has_size_quota", return_value=False)
    def test_returns_false_when_no_quota(self, mock_quota):
        result, reason = should_run_size(self.artifact)
        assert result is False
        assert reason == "quota"

    @patch("sentry.preprod.quotas.has_size_quota", return_value=False)
    def test_disabled_check_happens_before_quota_check(self, mock_quota):
        self.project.update_option("sentry:preprod_size_enabled_by_customer", False)
        result, reason = should_run_size(self.artifact)
        assert result is False
        assert reason == "disabled"
        mock_quota.assert_not_called()


class ShouldRunDistributionTest(TestCase):
    def setUp(self):
        super().setUp()
        self.artifact = self.create_preprod_artifact(project=self.project)

    @patch("sentry.preprod.quotas.has_installable_quota", return_value=True)
    def test_returns_true_when_enabled_by_default(self, mock_quota):
        result, reason = should_run_distribution(self.artifact)
        assert result is True
        assert reason is None

    @patch("sentry.preprod.quotas.has_installable_quota", return_value=True)
    def test_returns_false_when_disabled(self, mock_quota):
        self.project.update_option("sentry:preprod_distribution_enabled_by_customer", False)
        result, reason = should_run_distribution(self.artifact)
        assert result is False
        assert reason == "disabled"

    @patch("sentry.preprod.quotas.has_installable_quota", return_value=True)
    def test_returns_true_when_explicitly_enabled(self, mock_quota):
        self.project.update_option("sentry:preprod_distribution_enabled_by_customer", True)
        result, reason = should_run_distribution(self.artifact)
        assert result is True
        assert reason is None

    @patch("sentry.preprod.quotas.has_installable_quota", return_value=False)
    def test_returns_false_when_no_quota(self, mock_quota):
        result, reason = should_run_distribution(self.artifact)
        assert result is False
        assert reason == "quota"

    @patch("sentry.preprod.quotas.has_installable_quota", return_value=False)
    def test_disabled_check_happens_before_quota_check(self, mock_quota):
        self.project.update_option("sentry:preprod_distribution_enabled_by_customer", False)
        result, reason = should_run_distribution(self.artifact)
        assert result is False
        assert reason == "disabled"
        mock_quota.assert_not_called()
