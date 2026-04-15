from collections.abc import Mapping

from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.conf.server import SENTRY_EARLY_FEATURES
from sentry.runner.settings import configure, discover_configs


def _coerce_early_feature_flag_value(value: object) -> bool | None:
    """
    Map API input to a bool for SENTRY_FEATURES. Accepts JSON booleans, 0/1
    (common in scripts), and the strings "true"/"false" (case-insensitive).
    Returns None if the value cannot be interpreted safely.
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        if value == 1:
            return True
        if value == 0:
            return False
        return None
    if isinstance(value, str):
        lowered = value.lower()
        if lowered == "true":
            return True
        if lowered == "false":
            return False
        return None
    return None


@all_silo_endpoint
class InternalFeatureFlagsEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)
    owner = ApiOwner.HYBRID_CLOUD
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request) -> Response:
        if not settings.SENTRY_SELF_HOSTED:
            return Response("You are not self-hosting Sentry.", status=403)

        result = {}
        for key in SENTRY_EARLY_FEATURES:
            result[key] = {
                "value": settings.SENTRY_FEATURES.get(key, False),
                "description": SENTRY_EARLY_FEATURES[key],
            }

        return Response(result)

    def put(self, request: Request) -> Response:
        if not settings.SENTRY_SELF_HOSTED:
            return Response("You are not self-hosting Sentry.", status=403)

        payload: object = request.data
        if not isinstance(payload, Mapping):
            return Response(
                {"detail": "Feature flag updates must be a JSON object."},
                status=400,
            )

        valid_feature_flags = [flag for flag in payload if flag in SENTRY_EARLY_FEATURES]
        coerced_values: dict[str, bool] = {}
        for valid_flag in valid_feature_flags:
            coerced = _coerce_early_feature_flag_value(payload.get(valid_flag))
            if coerced is None:
                return Response(
                    {
                        "detail": (
                            f'Feature flag "{valid_flag}" must be true or false '
                            f"(boolean, 0 or 1, or the string true or false)."
                        )
                    },
                    status=400,
                )
            coerced_values[valid_flag] = coerced

        _, py, yml = discover_configs()
        # Open the file for reading and writing
        with open(py, "r+") as file:
            lines = file.readlines()
            # print(lines)
            for valid_flag in valid_feature_flags:
                match_found = False
                python_bool = "True" if coerced_values[valid_flag] else "False"
                new_string = f'\nSENTRY_FEATURES["{valid_flag}"]={python_bool}\n'
                # Search for the string match and update lines
                for i, line in enumerate(lines):
                    if valid_flag in line:
                        match_found = True
                        lines[i] = new_string

                        break

                # If no match found, append a new line
                if not match_found:
                    lines.append(new_string)

                # Move the file pointer to the beginning and truncate the file
                file.seek(0)
                file.truncate()

                # Write modified lines back to the file
                file.writelines(lines)
                configure(None, py, yml)

        return Response(status=200)
