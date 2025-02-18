import re

from rest_framework import serializers

from sentry.api.exceptions import ParameterValidationError
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import ExternalProviders
from sentry.integrations.validators.integrations import validate_provider
from sentry.models.organization import Organization

EXTERNAL_ID_LENGTH_MIN = 1
EXTERNAL_ID_LENGTH_MAX = 64

EXTERNAL_NAME_LENGTH_MIN = 1
EXTERNAL_NAME_LENGTH_MAX = 255
EXTERNAL_NAME_REGEX = re.compile(r"^@[\w/\.-]+$")


def _out_of_range_string(param: str, minimum: int, maximum: int, actual: int) -> str:
    return f"{param} has invalid length: {actual}. Length must be between {minimum} and {maximum}"


def is_valid_provider(
    provider: str, available_providers: set[ExternalProviders] | None = None
) -> bool:
    try:
        validate_provider(provider, available_providers)
    except ParameterValidationError:
        return False
    return True


def validate_external_id_option(external_id: str | None) -> str | None:
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
    organization_integration = integration_service.get_organization_integration(
        integration_id=int(integration_id), organization_id=organization.id
    )

    if organization_integration:
        return integration_id

    raise serializers.ValidationError("Integration does not exist for this organization")
