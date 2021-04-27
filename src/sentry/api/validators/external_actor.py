from typing import Optional

from rest_framework import serializers

from sentry.models import Organization, OrganizationIntegration

EXTERNAL_ID_MIN_LENGTH = 1
EXTERNAL_ID_MAX_LENGTH = 64


def validate_external_id_option(external_id: Optional[str]) -> Optional[str]:
    if not external_id:
        return None

    if not EXTERNAL_ID_MIN_LENGTH <= len(external_id) <= EXTERNAL_ID_MAX_LENGTH:
        raise serializers.ValidationError(
            f"external_id has invalid length ({EXTERNAL_ID_MIN_LENGTH}, {EXTERNAL_ID_MAX_LENGTH})"
        )

    return external_id


def validate_integration_id_option(
    integration_id: Optional[str], organization: Organization
) -> Optional[str]:
    if not integration_id:
        return None

    integration_query = OrganizationIntegration.objects.filter(
        organization=organization, integration_id=integration_id
    )
    if not integration_query.exists():
        raise serializers.ValidationError("Integration does not exist for this organization")
    return integration_id
