from sentry.preprod.permissions import has_preprod_access
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import Feature


class HasPreprodAccessTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.user = self.create_user()

    def test_early_adopter_flag_grants_access(self):
        """Test that early_adopter flag grants access regardless of feature flag"""
        self.organization.flags.early_adopter = True
        self.organization.save()

        # Access is granted even without the feature flag
        assert has_preprod_access(self.organization, self.user)

    def test_feature_flag_grants_access(self):
        """Test that feature flag grants access even without early_adopter"""
        self.organization.flags.early_adopter = False
        self.organization.save()

        with Feature({"organizations:preprod-frontend-routes": True}):
            assert has_preprod_access(self.organization, self.user)

    def test_no_access_without_either(self):
        """Test that access is denied without feature flag or early_adopter"""
        self.organization.flags.early_adopter = False
        self.organization.save()

        with Feature({"organizations:preprod-frontend-routes": False}):
            assert not has_preprod_access(self.organization, self.user)

    def test_early_adopter_takes_precedence(self):
        """Test that early_adopter grants access even if feature flag is disabled"""
        self.organization.flags.early_adopter = True
        self.organization.save()

        with Feature({"organizations:preprod-frontend-routes": False}):
            # Access is still granted due to early_adopter
            assert has_preprod_access(self.organization, self.user)

    def test_works_without_user(self):
        """Test that the function works without a user parameter"""
        self.organization.flags.early_adopter = True
        self.organization.save()

        assert has_preprod_access(self.organization)
