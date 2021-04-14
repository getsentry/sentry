import functools
from collections import defaultdict

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.utils.warnings import DeprecatedSettingWarning, UnsupportedBackend, seen_warnings


class InternalWarningsEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request):
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
                [(groupings[key], sort_by_message(values)) for key, values in groups.items()]
            ),
            "warnings": sort_by_message(warnings),
        }

        return Response(data)
