from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.preprod.build_distribution_utils import parse_build_number


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
    buildNumber = serializers.CharField(
        required=False,
        help_text=(
            "Current build number. Accepts a plain integer (e.g. 42) or a version "
            "string of two to three period-separated integers (e.g. 1.2.3), each up "
            "to 6 digits — the format used by build identifiers such as Apple's "
            "CFBundleVersion. Either this or mainBinaryIdentifier must be provided "
            "when buildVersion is set."
        ),
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

    def validate_buildNumber(self, value: str | None) -> int | None:
        if value is None or value == "":
            return None
        parsed = parse_build_number(value)
        if parsed is None:
            raise serializers.ValidationError(
                "buildNumber must be an integer or two to three period-separated "
                "integers of up to 6 digits each (e.g. 42 or 1.2.3)."
            )
        return parsed

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
