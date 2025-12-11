from sentry.models.options.organization_option import OrganizationOption
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test
from sentry.utils.seer import can_use_prevent_ai_features


@region_silo_test
class CanUsePreventAIFeaturesTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()

    def test_without_gen_ai_flag(self) -> None:
        """Test that can_use_prevent_ai_features returns False when gen-ai-features flag is disabled"""
        # Enable PR review and disable hide_ai_features (should normally pass)
        OrganizationOption.objects.set_value(
            self.organization, "sentry:enable_pr_review_test_generation", True
        )
        OrganizationOption.objects.set_value(self.organization, "sentry:hide_ai_features", False)

        # Without the feature flag enabled, should return False
        result = can_use_prevent_ai_features(self.organization)
        assert result is False

    def test_with_gen_ai_flag(self) -> None:
        """Test that can_use_prevent_ai_features checks org-level flags when gen-ai-features is enabled"""
        # Enable PR review and disable hide_ai_features
        OrganizationOption.objects.set_value(
            self.organization, "sentry:enable_pr_review_test_generation", True
        )
        OrganizationOption.objects.set_value(self.organization, "sentry:hide_ai_features", False)

        # With the feature flag enabled and correct org settings, should return True
        with with_feature("organizations:gen-ai-features"):
            result = can_use_prevent_ai_features(self.organization)
            assert result is True

    def test_with_gen_ai_flag_but_hide_ai(self) -> None:
        """Test that can_use_prevent_ai_features returns False when hide_ai_features is True"""
        # Enable PR review but enable hide_ai_features
        OrganizationOption.objects.set_value(
            self.organization, "sentry:enable_pr_review_test_generation", True
        )
        OrganizationOption.objects.set_value(self.organization, "sentry:hide_ai_features", True)

        # Even with feature flag enabled, should return False due to hide_ai_features
        with with_feature("organizations:gen-ai-features"):
            result = can_use_prevent_ai_features(self.organization)
            assert result is False

    def test_with_gen_ai_flag_but_no_pr_review(self) -> None:
        """Test that can_use_prevent_ai_features returns False when PR review is disabled"""
        # Disable PR review but disable hide_ai_features
        OrganizationOption.objects.set_value(
            self.organization, "sentry:enable_pr_review_test_generation", False
        )
        OrganizationOption.objects.set_value(self.organization, "sentry:hide_ai_features", False)

        # Even with feature flag enabled, should return False due to PR review being disabled
        with with_feature("organizations:gen-ai-features"):
            result = can_use_prevent_ai_features(self.organization)
            assert result is False

    def test_seat_based_plan_ignores_pr_review(self) -> None:
        """Test that can_use_prevent_ai_features ignores PR review toggle for seat-based plan orgs"""
        OrganizationOption.objects.set_value(self.organization, "sentry:hide_ai_features", False)
        OrganizationOption.objects.set_value(
            self.organization, "sentry:enable_pr_review_test_generation", False
        )

        with with_feature(
            ["organizations:gen-ai-features", "organizations:seat-based-seer-enabled"]
        ):
            result = can_use_prevent_ai_features(self.organization)
            assert result is True

    def test_usage_based_plan_checks_pr_review(self) -> None:
        """Test that can_use_prevent_ai_features checks PR review toggle for usage-based plan orgs"""
        OrganizationOption.objects.set_value(self.organization, "sentry:hide_ai_features", False)
        OrganizationOption.objects.set_value(
            self.organization, "sentry:enable_pr_review_test_generation", False
        )

        with with_feature(["organizations:gen-ai-features", "organizations:seer-added"]):
            result = can_use_prevent_ai_features(self.organization)
            assert result is False
