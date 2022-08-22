import re
from typing import Optional, Set

from rest_framework import serializers

from sentry.api.exceptions import ParameterValidationError
from sentry.api.validators.integrations import validate_provider
from sentry.models import Organization, OrganizationIntegration
from sentry.types.integrations import ExternalProviders

EXTERNAL_ID_LENGTH_MIN = 1
EXTERNAL_ID_LENGTH_MAX = 64

EXTERNAL_NAME_LENGTH_MIN = 1
EXTERNAL_NAME_LENGTH_MAX = 255
EXTERNAL_NAME_REGEX = re.compile(r"^@[\w/\.-]+$")


def _out_of_range_string(param: str, minimum: int, maximum: int, actual: int) -> str:
    return f"{param} has invalid length: {actual}. Length must be between {minimum} and {maximum}"


def is_valid_provider(
    provider: str, available_providers: Optional[Set[ExternalProviders]] = None
) -> bool:
    try:
        validate_provider(provider, available_providers)
    except ParameterValidationError:
        return False
    return True


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


def validate_external_name(external_name: str) -> str:
    if not (EXTERNAL_NAME_LENGTH_MIN <= len(external_name) <= EXTERNAL_NAME_LENGTH_MAX):
        raise serializers.ValidationError(
            _out_of_range_string(
                "External Name",
                EXTERNAL_NAME_LENGTH_MIN,
                EXTERNAL_NAME_LENGTH_MAX,
                len(external_name),
            )
        )

    if EXTERNAL_NAME_REGEX.match(external_name) is None:
        raise serializers.ValidationError(
            "External Name must start with '@' and can't contain special characters or spaces."
        )

    return external_name


def validate_integration_id(integration_id: str, organization: Organization) -> str:

    integration_query = OrganizationIntegration.objects.filter(
        organization=organization, integration_id=integration_id
    )
    if not integration_query.exists():
        raise serializers.ValidationError("Integration does not exist for this organization")
    return integration_id
