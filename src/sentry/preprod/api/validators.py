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
