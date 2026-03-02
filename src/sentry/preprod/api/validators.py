from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.preprod.models import PreprodArtifact


class PreprodListBuildsValidator(serializers.Serializer[Any]):
    """Validator for preprod list builds endpoint parameters."""

    app_id = serializers.CharField(required=False, help_text="Filter by app identifier")
    state = serializers.ChoiceField(
        choices=PreprodArtifact.ArtifactState.as_choices(),
        required=False,
        help_text="Filter by artifact state",
    )
    build_version = serializers.CharField(required=False, help_text="Filter by build version")
    build_configuration = serializers.CharField(
        required=False, help_text="Filter by build configuration name"
    )
    platform = serializers.ChoiceField(
        choices=[("ios", "iOS"), ("android", "Android"), ("macos", "macOS")],
        required=False,
        help_text="Filter by platform",
    )
    release_version = serializers.CharField(
        required=False,
        help_text="Filter by release version (formats: 'app_id@version+build_number' or 'app_id@version')",
    )
    query = serializers.CharField(
        max_length=100,
        required=False,
        help_text="General search across app name, app ID, build version, and commit SHA",
    )
    per_page = serializers.IntegerField(
        default=25,
        min_value=1,
        max_value=100,
        required=False,
        help_text="Number of results per page",
    )
    cursor = serializers.CharField(required=False, help_text="Cursor for pagination")
    start = serializers.DateTimeField(required=False, help_text="Filter start date")
    end = serializers.DateTimeField(required=False, help_text="Filter end date")
    statsPeriod = serializers.CharField(
        required=False,
        help_text="Relative period for filtering (e.g., '7d')",
    )

    def validate_state(self, value: str | None) -> int | None:
        """Convert state string to integer enum value."""
        if value is None:
            return None

        # Get valid integer values and string names
        choices = PreprodArtifact.ArtifactState.as_choices()
        valid_int_values = [choice[0] for choice in choices]
        valid_str_names = [choice[1] for choice in choices]

        # Try to convert to int (handles numeric strings like "0", "1", etc.)
        try:
            state_int = int(value)
            if state_int in valid_int_values:
                return state_int
        except (ValueError, TypeError):
            pass

        # Check if it's a valid state name (like "uploading", "uploaded", etc.)
        try:
            index = valid_str_names.index(value)
            return valid_int_values[index]
        except ValueError:
            pass

        raise serializers.ValidationError(f"Invalid state: {value}")

    def validate_query(self, value: str | None) -> str | None:
        """Validate search query length."""
        if value and len(value.strip()) > 100:
            raise serializers.ValidationError("Search term too long")
        return value.strip() if value else value

    def validate_platform(self, value: str | None) -> str | None:
        """Normalize platform value."""
        if value:
            return value.lower()
        return value


class PreprodLatestInstallableBuildValidator(serializers.Serializer[Any]):
    """Validator for the public latest installable build endpoint (camelCase params)."""

    appId = serializers.CharField(required=True, help_text="App identifier")
    platform = serializers.ChoiceField(
        choices=[("apple", "Apple"), ("android", "Android")],
        required=True,
        help_text='Platform: "apple" or "android"',
    )
    buildVersion = serializers.CharField(
        required=False,
        help_text="Current build version. When provided, enables check-for-updates mode.",
    )
    buildNumber = serializers.IntegerField(
        required=False,
        help_text="Current build number. Either this or mainBinaryIdentifier must be provided when buildVersion is set.",
    )
    mainBinaryIdentifier = serializers.CharField(
        required=False,
        help_text="UUID of the main binary (e.g. Mach-O UUID for Apple builds). Either this or buildNumber must be provided when buildVersion is set.",
    )
    buildConfiguration = serializers.CharField(
        required=False, help_text="Filter by build configuration name"
    )
    codesigningType = serializers.CharField(required=False, help_text="Filter by code signing type")

    def validate_platform(self, value: str | None) -> str | None:
        if value:
            return value.lower()
        return value

    def validate(self, data: dict[str, Any]) -> dict[str, Any]:
        build_version = data.get("buildVersion")
        if build_version:
            main_binary_identifier = data.get("mainBinaryIdentifier")
            build_number = data.get("buildNumber")
            if not main_binary_identifier and build_number is None:
                raise serializers.ValidationError(
                    "Either mainBinaryIdentifier or buildNumber is required when buildVersion is provided."
                )
        return data
