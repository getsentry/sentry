from rest_framework.exceptions import ErrorDetail

from sentry.api.helpers.group_index.validators.group import GroupValidator
from sentry.api.helpers.group_index.validators.status_details import StatusDetailsValidator
from sentry.models.release import Release
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

    def _validate_in_future_release_existing_release_helper(self, expected_release: Release):
        """Helper method to validate existing release."""
        validator = self.get_validator(data={"inFutureRelease": expected_release.version})
        assert validator.is_valid()
        assert validator.validated_data["inFutureRelease"] == expected_release
        assert validator.validated_data["_future_release_version"] == expected_release.version

    @with_feature("organizations:resolve-in-future-release")
    def test_validate_in_future_release_existing_release(self):
        """Test that validation passes when release exists for both semver and non-semver versions."""
        expected_release = self.create_release(project=self.project, version="package@1.0.0")
        self._validate_in_future_release_existing_release_helper(expected_release)

        expected_release = self.create_release(project=self.project, version="non-semver-version")
        self._validate_in_future_release_existing_release_helper(expected_release)

    @with_feature("organizations:resolve-in-future-release")
    def test_validate_in_future_release_nonexistent_release_valid_semver(self):
        """Test that validation passes when release doesn't exist but is valid semver."""
        validator = self.get_validator(data={"inFutureRelease": "package@1.0.0"})
        assert validator.is_valid()
        assert validator.validated_data["inFutureRelease"] is None
        assert validator.validated_data["_future_release_version"] == "package@1.0.0"

    @with_feature("organizations:resolve-in-future-release")
    def test_validate_in_future_release_nonexistent_release_invalid_semver(self):
        """Test that validation fails when release doesn't exist and is not valid semver."""
        validator = self.get_validator(data={"inFutureRelease": "non-semver-version"})
        assert not validator.is_valid()
        assert validator.errors.get("inFutureRelease") == [
            ErrorDetail(
                string="Invalid semver format. Please use format: package@major.minor.patch[-prerelease][+build]",
                code="invalid",
            )
        ]

    @with_feature("organizations:resolve-in-future-release")
    def test_validate_in_future_release_as_nested_serializer(self):
        """
        Test that _future_release_version is preserved when StatusDetailsValidator
        is used as a nested serializer inside GroupValidator.
        """
        parent_validator = GroupValidator(
            data={
                "status": "resolvedInFutureRelease",
                "statusDetails": {"inFutureRelease": "package@2.0.0"},
            },
            partial=True,
            context={"project": self.project, "organization": self.organization},
        )

        assert parent_validator.is_valid()
        status_details = parent_validator.validated_data.get("statusDetails", {})
        assert status_details["inFutureRelease"] is None
        assert status_details["_future_release_version"] == "package@2.0.0"
