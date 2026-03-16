from __future__ import annotations

from typing import Any

from rest_framework import serializers


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
