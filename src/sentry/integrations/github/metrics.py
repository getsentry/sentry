# 40301 - To perform this action, use an API key from an API integration.
from sentry.shared_integrations.exceptions import ApiError, IntegrationFormError


def filter_user_config_errors(error: ApiError) -> None:
    if error.code == "422":
        invalid_fields = {}
        for e in error.json.get("errors", []):
            field = e.get("field", "unknown field")
            code = e.get("code", "invalid")
            value = e.get("value", "unknown value")

            invalid_fields[field] = f"Got {code} value: {value} for field: {field}"
            raise IntegrationFormError(invalid_fields) from error
    elif error.code == "410":
        raise IntegrationFormError(
            {"message": "Issues are disabled for this repo, please check your repo's permissions"}
        ) from error
    else:
        raise error
