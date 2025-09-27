import pytest
from rest_framework import serializers

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
        validator = StatusDetailsValidator(data=data or {}, context=context)
        validator.initial_data = data or {}
        return validator

    def test_validate_in_future_release_without_feature_flag(self):
        """Test that validation fails when feature flag is not enabled."""
        validator = self.get_validator({"inFutureRelease": "1.0.0"})

        with pytest.raises(serializers.ValidationError) as exc_info:
            validator.validate_inFutureRelease("1.0.0")

        assert "Your organization does not have access to this feature." in str(exc_info.value)

    @with_feature("organizations:resolve-in-future-release")
    def test_validate_in_future_release_invalid_version_format(self):
        """Test that validation fails for invalid version formats."""
        validator = self.get_validator()

        # Use a character from BAD_RELEASE_CHARS (\r\n\f\x0c\t/\\)
        with pytest.raises(serializers.ValidationError) as exc_info:
            validator.validate_inFutureRelease("version\twith\ttabs")

        assert "Invalid release version format" in str(exc_info.value)

    @with_feature("organizations:resolve-in-future-release")
    def test_validate_in_future_release_invalid_semver_format(self):
        """Test that validation fails for invalid semver format with @ symbol."""
        validator = self.get_validator()

        with pytest.raises(serializers.ValidationError) as exc_info:
            validator.validate_inFutureRelease("package@invalid.semver")

        assert "Invalid semver format" in str(exc_info.value)

    @with_feature("organizations:resolve-in-future-release")
    def test_validate_in_future_release_valid_semver_format(self):
        """Test that validation passes for valid semver format with @ symbol."""
        release = self.create_release(project=self.project, version="package@1.0.0")
        validator = self.get_validator()

        result = validator.validate_inFutureRelease("package@1.0.0")
        assert result == release

    @with_feature("organizations:resolve-in-future-release")
    def test_validate_in_future_release_nonexistent_release(self):
        """Test that validation fails when release doesn't exist."""
        validator = self.get_validator()

        result = validator.validate_inFutureRelease("nonexistent-version")
        assert result is None

    @with_feature("organizations:resolve-in-future-release")
    def test_validate_in_future_release_existing_release(self):
        """Test that validation passes when release exists."""
        release = self.create_release(project=self.project, version="version-a")
        validator = self.get_validator()

        result = validator.validate_inFutureRelease("version-a")
        assert result == release

    @with_feature("organizations:resolve-in-future-release")
    def test_preserve_future_release_version(self):
        """Test that the original version string is preserved in _future_release_version."""
        expected_release = self.create_release(project=self.project, version="2.0.0")

        validator = self.get_validator(data={"inFutureRelease": "2.0.0"})

        validated_release = validator.validate_inFutureRelease("2.0.0")
        assert validated_release == expected_release

        attrs = {"inFutureRelease": validated_release}
        updated_attrs = validator._preserve_future_release_version(attrs)

        assert updated_attrs["inFutureRelease"] == expected_release
        assert updated_attrs["_future_release_version"] == expected_release.version

    @with_feature("organizations:resolve-in-future-release")
    def test_preserve_future_release_version_no_version(self):
        """Test that _preserve_future_release_version handles missing version gracefully."""
        validator = self.get_validator()

        attrs = {"inFutureRelease": None}
        result = validator._preserve_future_release_version(attrs)

        # Should not add _future_release_version if no version in initial_data
        assert "_future_release_version" not in result
        assert result["inFutureRelease"] is None

    @with_feature("organizations:resolve-in-future-release")
    def test_validate(self):
        """Test the main validate() method that calls _preserve_future_release_version."""
        expected_release = self.create_release(project=self.project, version="3.0.0")

        validator = self.get_validator(data={"inFutureRelease": "3.0.0"})

        validated_release = validator.validate_inFutureRelease("3.0.0")
        assert validated_release == expected_release

        attrs = {"inFutureRelease": validated_release}
        result = validator.validate(attrs)

        assert result["_future_release_version"] == expected_release.version
        assert result["inFutureRelease"] == expected_release

    @with_feature("organizations:resolve-in-future-release")
    def test_validate_in_future_release_different_organization(self):
        """Test that validation fails when release exists in different organization."""
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        self.create_release(project=other_project, version="1.0.0")

        validator = self.get_validator()

        with pytest.raises(serializers.ValidationError) as exc_info:
            validator.validate_inFutureRelease("1.0.0")

        assert "Unable to find a release with the given version." in str(exc_info.value)

    @with_feature("organizations:resolve-in-future-release")
    def test_validate_in_future_release_different_project_same_org(self):
        """Test that validation fails when release exists in different project within same org."""
        other_project = self.create_project(organization=self.organization)
        self.create_release(project=other_project, version="1.0.0")

        validator = self.get_validator()

        with pytest.raises(serializers.ValidationError) as exc_info:
            validator.validate_inFutureRelease("1.0.0")

        assert "Unable to find a release with the given version." in str(exc_info.value)
