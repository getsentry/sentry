from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.conf.server import SENTRY_EARLY_FEATURES
from sentry.runner.settings import configure, discover_configs


@all_silo_endpoint
class InternalFeatureFlagsEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)
    owner = ApiOwner.RELOCATION
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

        data = request.data.keys()
        valid_feature_flags = [flag for flag in data if SENTRY_EARLY_FEATURES.get(flag, False)]
        _, py, yml = discover_configs()
        # Open the file for reading and writing
        with open(py, "r+") as file:
            lines = file.readlines()
            # print(lines)
            for valid_flag in valid_feature_flags:
                match_found = False
                new_string = (
                    f'\nSENTRY_FEATURES["{valid_flag}"]={request.data.get(valid_flag,False)}\n'
                )
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
