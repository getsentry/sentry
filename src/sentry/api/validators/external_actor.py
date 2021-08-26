from typing import Optional

from rest_framework import serializers

from sentry.models import Organization, OrganizationIntegration

EXTERNAL_ID_LENGTH_MIN = 1
EXTERNAL_ID_LENGTH_MAX = 64


def _out_of_range_string(param: str, minimum: int, maximum: int, actual: int) -> str:
    return f"{param} has invalid length: {actual}. Length must be between {minimum} and {maximum}"


def validate_external_id_option(external_id: Optional[str]) -> Optional[str]:
    if not external_id:
        return None

    if not EXTERNAL_ID_LENGTH_MIN <= len(external_id) <= EXTERNAL_ID_LENGTH_MAX:
        raise serializers.ValidationError(
            _out_of_range_string(
                "external_id",
                EXTERNAL_ID_LENGTH_MIN,
                EXTERNAL_ID_LENGTH_MAX,
                len(external_id),
            )
        )

    return external_id


def validate_integration_id(integration_id: str, organization: Organization) -> str:

    integration_query = OrganizationIntegration.objects.filter(
        organization=organization, integration_id=integration_id
    )
    if not integration_query.exists():
        raise serializers.ValidationError("Integration does not exist for this organization")
    return integration_id
