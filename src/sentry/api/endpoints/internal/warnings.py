import functools
from collections import defaultdict

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.utils.warnings import DeprecatedSettingWarning, UnsupportedBackend, seen_warnings


@all_silo_endpoint
class InternalWarningsEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (SuperuserPermission,)

    def get(self, request: Request) -> Response:
        groupings = {
            DeprecatedSettingWarning: "Deprecated Settings",
            UnsupportedBackend: "Unsupported Backends",
        }

        groups = defaultdict(list)
        warnings = []
        for warning in seen_warnings:
            cls = type(warning)
            if cls in groupings:
                groups[cls].append(str(warning))
            else:
                warnings.append(str(warning))

        sort_by_message = functools.partial(sorted, key=str)

        data = {
            "groups": sorted(
                (groupings[key], sort_by_message(values)) for key, values in groups.items()
            ),
            "warnings": sort_by_message(warnings),
        }

        return Response(data)
