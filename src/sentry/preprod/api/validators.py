from rest_framework import serializers

from sentry.preprod.models import PreprodArtifact


class PreprodListBuildsValidator(serializers.Serializer):
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

    def validate_state(self, value):
        """Convert state string to integer if needed."""
        if value is None:
            return value

        try:
            state_int = int(value)
            valid_state_values = [
                choice[0] for choice in PreprodArtifact.ArtifactState.as_choices()
            ]
            if state_int in valid_state_values:
                return state_int
        except (ValueError, TypeError):
            pass

        # If it's already a valid choice, return as-is
        valid_state_values = [choice[0] for choice in PreprodArtifact.ArtifactState.as_choices()]
        if value in valid_state_values:
            return value

        raise serializers.ValidationError(f"Invalid state: {value}")

    def validate_query(self, value):
        """Validate search query length."""
        if value and len(value.strip()) > 100:
            raise serializers.ValidationError("Search term too long")
        return value.strip() if value else value

    def validate_platform(self, value):
        """Normalize platform value."""
        if value:
            return value.lower()
        return value
