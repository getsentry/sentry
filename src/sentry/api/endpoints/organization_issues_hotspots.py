import os.path

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.endpoints.organization_events import OrganizationEventsEndpoint
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class OrganizationIssuesHotspotsEndpoint(OrganizationEventsEndpoint):
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(10, 1),
            RateLimitCategory.USER: RateLimit(10, 1),
            RateLimitCategory.ORGANIZATION: RateLimit(10, 1),
        }
    }

    def get(self, request: Request, organization) -> Response:
        """
        # Static Demo data for video making
        output = [
            {
                "id": "<project_root>",
                "depth": 0,
                "index": 0,
            },
            {
                "id": "<project_root>/billiard",
                "depth": 1,
                "index": 1,
            },
            {
                "id": "<project_root>/billiard/pool.py",
                "errorCount": 20,
                "uniqueErrorCount": 1,
                "depth": 2,
                "index": 2,
            },
            {
                "id": "<project_root>/getsentry",
                "depth": 1,
                "index": 3,
            },
            {
                "id": "<project_root>/getsentry/utils",
                "depth": 2,
                "index": 4,
            },
            {
                "id": "<project_root>/getsentry/utils/flagr.py",
                "errorCount": 200,
                "uniqueErrorCount": 2,
                "depth": 3,
                "index": 5,
            },
            {
                "id": "<project_root>/sentry",
                "depth": 1,
                "index": 6,
            },
            {
                "id": "<project_root>/sentry/api",
                "depth": 2,
                "index": 7,
            },
            {
                "id": "<project_root>/sentry/api/client.py",
                "errorCount": 100,
                "uniqueErrorCount": 3,
                "depth": 3,
                "index": 8,
            },
            {
                "id": "<project_root>/sentry/api/endpoints",
                "depth": 3,
                "index": 10,
            },
            {
                "id": "<project_root>/sentry/api/endpoints/release_deploys.py",
                "errorCount": 200,
                "uniqueErrorCount": 3,
                "depth": 4,
                "index": 11,
            },
            {
                "id": "<project_root>/sentry/api/fields",
                "depth": 3,
                "index": 12,
            },
            {
                "id": "<project_root>/sentry/api/fields/avatar.py",
                "errorCount": 500,
                "uniqueErrorCount": 3,
                "depth": 3,
                "index": 13,
            },
            {
                "id": "<project_root>/sentry/db",
                "depth": 1,
                "index": 14,
            },
            {
                "id": "<project_root>/sentry/db/models",
                "depth": 2,
                "index": 15,
            },
            {
                "id": "<project_root>/sentry/db/models/fields",
                "depth": 3,
                "index": 16,
            },
            {
                "id": "<project_root>/sentry/db/models/fields/bounded.py",
                "errorCount": 200,
                "uniqueErrorCount": 7,
                "depth": 4,
                "index": 17,
            },
            {
                "id": "<project_root>/sentry/identity",
                "depth": 2,
                "index": 17,
            },
            {
                "id": "<project_root>/sentry/identity/oauth2.py",
                "errorCount": 200,
                "uniqueErrorCount": 12,
                "depth": 2,
                "index": 18,
            },
            {
                "id": "<project_root>/sentry/interfaces",
                "depth": 2,
                "index": 19,
            },
            {
                "id": "<project_root>/sentry/interfaces/contexts.py",
                "errorCount": 350,
                "uniqueErrorCount": 2,
                "depth": 2,
                "index": 20,
            },
            {
                "id": "<project_root>/sentry/models",
                "depth": 2,
                "index": 21,
            },
            {
                "id": "<project_root>/sentry/models/organizationmember.py",
                "errorCount": 2000,
                "uniqueErrorCount": 1,
                "depth": 2,
                "index": 22,
            },
            {
                "id": "<project_root>/sentry/models/releasefile.py",
                "errorCount": 123,
                "uniqueErrorCount": 2,
                "depth": 2,
                "index": 23,
            },
            {
                "id": "<project_root>/sentry/net",
                "depth": 2,
                "index": 24,
            },
            {
                "id": "<project_root>/sentry/net/socket.py",
                "errorCount": 450,
                "uniqueErrorCount": 2,
                "depth": 2,
                "index": 25,
            },
            {
                "id": "<project_root>/sentry/receivers",
                "depth": 2,
                "index": 26,
            },
            {
                "id": "<project_root>/sentry/receivers/releases.py",
                "errorCount": 34,
                "uniqueErrorCount": 1,
                "depth": 2,
                "index": 27,
            },
            {
                "id": "<project_root>/sentry/release_health",
                "depth": 2,
                "index": 28,
            },
            {
                "id": "<project_root>/sentry/release_health/tasks.py",
                "errorCount": 23,
                "uniqueErrorCount": 1,
                "depth": 2,
                "index": 29,
            },
            {
                "id": "<project_root>/sentry/shared_integrations",
                "depth": 2,
                "index": 30,
            },
            {
                "id": "<project_root>/sentry/shared_integrations/client",
                "depth": 3,
                "index": 31,
            },
            {
                "id": "<project_root>/sentry/shared_integrations/client/base.py",
                "errorCount": 1234,
                "uniqueErrorCount": 2,
                "depth": 3,
                "index": 32,
            },
            {
                "id": "<project_root>/sentry/utils",
                "depth": 2,
                "index": 33,
            },
            {
                "id": "<project_root>/sentry/utils/json.py",
                "errorCount": 250,
                "uniqueErrorCount": 1,
                "depth": 2,
                "index": 34,
            },
            {
                "id": "<project_root>/sentry/utils/locking",
                "depth": 3,
                "index": 35,
            },
            {
                "id": "<project_root>/sentry/utils/locking/lock.py",
                "errorCount": 90,
                "uniqueErrorCount": 2,
                "depth": 3,
                "index": 36,
            },
            {
                "id": "<project_root>/sentry/utils/monitors.py",
                "errorCount": 234,
                "uniqueErrorCount": 3,
                "depth": 2,
                "index": 38,
            },
        ]
        """

        response = super().get(request, organization)
        response_data = response.data.get("data", {})

        output = []
        paths_already_in_output = {}
        index = 1
        for trace_dict in response_data:
            trace_file_list = trace_dict.get("stack.filename", [])
            if trace_file_list:
                file_name = trace_file_list[-1]
                if not file_name:
                    continue

                parts = ["<project_root>"] + os.path.normpath(file_name).split(os.sep)

                current_path = ""
                depth = 1
                for part in parts[:-1]:
                    current_dict = {}
                    current_path = os.path.join(current_path, part)
                    current_dict["id"], current_dict["index"], current_dict["depth"] = (
                        current_path,
                        index,
                        depth,
                    )
                    index += 1
                    depth += 1

                    if current_path not in paths_already_in_output:
                        output.append(current_dict)
                        paths_already_in_output[current_path] = True

                current_dict = {}
                current_path = os.path.join(current_path, parts[-1])
                current_dict["id"], current_dict["index"], current_dict["depth"] = (
                    current_path,
                    index,
                    depth,
                )
                current_dict["errorCount"] = trace_dict.get("count()", None)
                current_dict["uniqueErrorCount"] = trace_dict.get("count_unique(issue)", None)
                index += 1
                output.append(current_dict)

        return Response(output)
