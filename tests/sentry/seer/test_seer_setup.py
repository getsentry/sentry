from unittest.mock import patch

import orjson

from sentry.models.promptsactivity import PromptsActivity
from sentry.seer.seer_setup import (
    get_seer_org_acknowledgement,
    get_seer_org_acknowledgement_for_scanner,
    get_seer_user_acknowledgement,
)
from sentry.testutils.cases import TestCase


class TestGetSeerOrgAcknowledgementForScanner(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(name="test-org")
        self.user = self.create_user()
        self.feature_name = "seer_autofix_setup_acknowledged"

    def test_returns_true_when_org_has_acknowledged(self):
        """Test returns True when organization has acknowledged via PromptsActivity."""
        PromptsActivity.objects.create(
            user_id=self.user.id,
            feature=self.feature_name,
            organization_id=self.organization.id,
            project_id=0,
            data=orjson.dumps({"dismissed_ts": 123456789}).decode("utf-8"),
        )

        result = get_seer_org_acknowledgement_for_scanner(self.organization)
        assert result is True

    def test_returns_false_when_no_acknowledgement_and_feature_not_enabled(self):
        """Test returns False when no acknowledgement exists and feature flag is disabled."""
        result = get_seer_org_acknowledgement_for_scanner(self.organization)
        assert result is False

    @patch("sentry.seer.seer_setup.in_rollout_group")
    def test_returns_true_when_feature_enabled_and_passes_rollout(self, mock_in_rollout_group):
        """Test returns True when gen-ai-consent-flow-removal is enabled and passes rollout rate."""
        with self.feature("organizations:gen-ai-consent-flow-removal"):
            mock_in_rollout_group.return_value = True

            result = get_seer_org_acknowledgement_for_scanner(self.organization)

            assert result is True
            mock_in_rollout_group.assert_called_once_with(
                "seer.scanner_no_consent.rollout_rate", self.organization.id
            )

    @patch("sentry.seer.seer_setup.in_rollout_group")
    def test_returns_false_when_feature_enabled_but_fails_rollout(self, mock_in_rollout_group):
        """Test returns False when gen-ai-consent-flow-removal is enabled but fails rollout rate."""
        with self.feature("organizations:gen-ai-consent-flow-removal"):
            mock_in_rollout_group.return_value = False

            result = get_seer_org_acknowledgement_for_scanner(self.organization)

            assert result is False
            mock_in_rollout_group.assert_called_once_with(
                "seer.scanner_no_consent.rollout_rate", self.organization.id
            )

    @patch("sentry.seer.seer_setup.in_rollout_group")
    def test_returns_true_when_feature_enabled_and_100_percent_rollout(self, mock_in_rollout_group):
        """Test returns True when gen-ai-consent-flow-removal is enabled with 100% rollout."""
        with self.feature("organizations:gen-ai-consent-flow-removal"):
            mock_in_rollout_group.return_value = True

            result = get_seer_org_acknowledgement_for_scanner(self.organization)

            assert result is True
            mock_in_rollout_group.assert_called_once_with(
                "seer.scanner_no_consent.rollout_rate", self.organization.id
            )

    @patch("sentry.seer.seer_setup.in_rollout_group")
    def test_returns_false_when_feature_enabled_and_0_percent_rollout(self, mock_in_rollout_group):
        """Test returns False when gen-ai-consent-flow-removal is enabled with 0% rollout."""
        with self.feature("organizations:gen-ai-consent-flow-removal"):
            mock_in_rollout_group.return_value = False

            result = get_seer_org_acknowledgement_for_scanner(self.organization)

            assert result is False
            mock_in_rollout_group.assert_called_once_with(
                "seer.scanner_no_consent.rollout_rate", self.organization.id
            )

    @patch("sentry.seer.seer_setup.in_rollout_group")
    def test_prioritizes_acknowledgement_over_feature_flag(self, mock_in_rollout_group):
        """Test that explicit acknowledgement takes priority over feature flag rollout."""
        PromptsActivity.objects.create(
            user_id=self.user.id,
            feature=self.feature_name,
            organization_id=self.organization.id,
            project_id=0,
            data=orjson.dumps({"dismissed_ts": 123456789}).decode("utf-8"),
        )

        with self.feature("organizations:gen-ai-consent-flow-removal"):
            mock_in_rollout_group.return_value = False

            result = get_seer_org_acknowledgement_for_scanner(self.organization)

            assert result is True
            # Should return True before checking rollout
            mock_in_rollout_group.assert_not_called()

    def test_different_organizations_isolated(self):
        """Test that acknowledgements are isolated per organization."""
        org2 = self.create_organization(name="test-org-2")

        PromptsActivity.objects.create(
            user_id=self.user.id,
            feature=self.feature_name,
            organization_id=self.organization.id,
            project_id=0,
            data=orjson.dumps({"dismissed_ts": 123456789}).decode("utf-8"),
        )

        result1 = get_seer_org_acknowledgement_for_scanner(self.organization)
        result2 = get_seer_org_acknowledgement_for_scanner(org2)

        assert result1 is True
        assert result2 is False


class TestGetSeerOrgAcknowledgement(TestCase):
    """Test the standard get_seer_org_acknowledgement function for comparison."""

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(name="test-org")
        self.user = self.create_user()
        self.feature_name = "seer_autofix_setup_acknowledged"

    def test_returns_true_when_gen_ai_consent_removal_enabled(self):
        """Test returns True when gen-ai-consent-flow-removal feature is enabled."""
        with self.feature("organizations:gen-ai-consent-flow-removal"):
            result = get_seer_org_acknowledgement(self.organization)
            assert result is True

    def test_returns_true_when_org_has_acknowledged(self):
        """Test returns True when organization has acknowledged via PromptsActivity."""
        PromptsActivity.objects.create(
            user_id=self.user.id,
            feature=self.feature_name,
            organization_id=self.organization.id,
            project_id=0,
            data=orjson.dumps({"dismissed_ts": 123456789}).decode("utf-8"),
        )

        result = get_seer_org_acknowledgement(self.organization)
        assert result is True

    def test_returns_false_when_no_acknowledgement_and_feature_not_enabled(self):
        """Test returns False when no acknowledgement exists and feature flag is disabled."""
        result = get_seer_org_acknowledgement(self.organization)
        assert result is False


class TestGetSeerUserAcknowledgement(TestCase):
    """Test the get_seer_user_acknowledgement function."""

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(name="test-org")
        self.user = self.create_user()
        self.feature_name = "seer_autofix_setup_acknowledged"

    def test_returns_true_when_gen_ai_consent_removal_enabled(self):
        """Test returns True when gen-ai-consent-flow-removal feature is enabled."""
        with self.feature("organizations:gen-ai-consent-flow-removal"):
            result = get_seer_user_acknowledgement(self.user.id, self.organization)
            assert result is True

    def test_returns_true_when_user_has_acknowledged(self):
        """Test returns True when user has acknowledged via PromptsActivity."""
        PromptsActivity.objects.create(
            user_id=self.user.id,
            feature=self.feature_name,
            organization_id=self.organization.id,
            project_id=0,
            data=orjson.dumps({"dismissed_ts": 123456789}).decode("utf-8"),
        )

        result = get_seer_user_acknowledgement(self.user.id, self.organization)
        assert result is True

    def test_returns_false_when_no_acknowledgement_and_feature_not_enabled(self):
        """Test returns False when user has not acknowledged and feature flag is disabled."""
        result = get_seer_user_acknowledgement(self.user.id, self.organization)
        assert result is False

    def test_returns_false_when_different_user_acknowledged(self):
        """Test returns False when a different user has acknowledged."""
        other_user = self.create_user()

        PromptsActivity.objects.create(
            user_id=other_user.id,
            feature=self.feature_name,
            organization_id=self.organization.id,
            project_id=0,
            data=orjson.dumps({"dismissed_ts": 123456789}).decode("utf-8"),
        )

        result = get_seer_user_acknowledgement(self.user.id, self.organization)
        assert result is False
