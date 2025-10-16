from rest_framework.exceptions import ErrorDetail

from sentry.api.helpers.group_index.validators.status_details import StatusDetailsValidator
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature


class StatusDetailsValidatorTest(TestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.organization = self.project.organization

    def get_validator(self, data=None, context=None):
        if context is None:
            context = {"project": self.project}
        validator = StatusDetailsValidator(data=data or {}, context=context, partial=True)
        return validator

    def test_validate_in_future_release_without_feature_flag(self):
        """Test that validation fails when feature flag is not enabled."""
        validator = self.get_validator(data={"inFutureRelease": "package@1.0.0"})
        assert not validator.is_valid()
        assert validator.errors.get("inFutureRelease") == [
            ErrorDetail(
                string="Your organization does not have access to this feature.", code="invalid"
            )
        ]

    @with_feature("organizations:resolve-in-future-release")
    def test_validate_in_future_release_invalid_version_format(self):
        """Test that validation fails for invalid version formats."""
        validator = self.get_validator(data={"inFutureRelease": "version\twith\ttabs"})
        assert not validator.is_valid()
        assert validator.errors.get("inFutureRelease") == [
            ErrorDetail(
                string="Invalid release version format. Please use semver format: package@major.minor.patch[-prerelease][+build].",
                code="invalid",
            )
        ]

    @with_feature("organizations:resolve-in-future-release")
    def test_validate_in_future_release_invalid_semver_format(self):
        """Test that validation fails for invalid semver formats."""
        validator = self.get_validator(data={"inFutureRelease": "package@invalid.semver"})
        assert not validator.is_valid()
        assert validator.errors.get("inFutureRelease") == [
            ErrorDetail(
                string="Invalid semver format. Please use format: package@major.minor.patch[-prerelease][+build]",
                code="invalid",
            )
        ]

    @with_feature("organizations:resolve-in-future-release")
    def test_validate_in_future_release_existing_release(self):
        """Test that validation passes when release exists."""
        expected_release = self.create_release(project=self.project, version="package@1.0.0")
        validator = self.get_validator(data={"inFutureRelease": "package@1.0.0"})
        assert validator.is_valid()
        assert validator.validated_data["inFutureRelease"] == expected_release
        assert validator.validated_data["_future_release_version"] == expected_release.version

    @with_feature("organizations:resolve-in-future-release")
    def test_validate_in_future_release_nonexistent_release(self):
        """Test that validation passes when release doesn't exist."""
        validator = self.get_validator(data={"inFutureRelease": "package@1.0.0"})
        assert validator.is_valid()
        assert validator.validated_data["inFutureRelease"] is None
        assert validator.validated_data["_future_release_version"] == "package@1.0.0"
