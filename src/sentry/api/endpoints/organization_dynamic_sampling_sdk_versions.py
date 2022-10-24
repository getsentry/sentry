from datetime import timedelta
from functools import cmp_to_key
from typing import Any, Dict

from dateutil.parser import parse as parse_date
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_relay.exceptions import RelayError
from sentry_relay.processing import compare_version as compare_version_relay

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.snuba import discover
from sentry.utils.dates import ensure_aware

SDK_NAME_FILTER_THRESHOLD = 0.1
SDK_VERSION_FILTER_THRESHOLD = 0.05

# Some SDKs do not support sampling yet,
# we show prompts that they should update to the latest version.
# Allowlist of supported SDKs and only prompt to update those.
ALLOWED_SDK_NAMES = frozenset(
    (
        "sentry.javascript.browser",  # JavaScript Browser
        "sentry.javascript.react",  # React
        "sentry.javascript.angular",  # Angular
        "sentry.javascript.ember",  # Ember
        "sentry.javascript.vue",  # Vue.js
        "sentry.javascript.nextjs",  # Next.js
        "sentry.javascript.remix",  # RemixJS
        "sentry.javascript.node",  # Node, Express, koa
        "sentry.javascript.react-native",  # React Native
        "sentry.javascript.serverless",  # AWS Lambda Node
        "sentry.javascript.gatsby",  # Gatsby
        "sentry.javascript.svelte",  # Svelte
        "sentry.python",  # python, django, flask, FastAPI, Starlette, Bottle, Celery, pyramid, rq
        "sentry.python.serverless",  # AWS Lambda
        "sentry.cocoa",  # iOS
        "sentry.ruby",  # Ruby
        "sentry.ruby.rails",  # Rails
        "sentry.php",  # PHP
        "sentry.php.laravel",  # Laravel
        "sentry.php.symfony",  # Symfony
    )
)
# We want sentry.java, sentry.java.spring, sentry.java.android, sentry.java.android.timber,
# and all others to match
# Same for sentry.dart, sentry.dart.browser, and sentry.dart.flutter
# Same for sentry.dotnet, sentry.dotnet.aspnetcore, sentry.dotnet.maui, etc.
ALLOWED_SDK_NAMES_PREFIXES = frozenset(("sentry.java", "sentry.dart", "sentry.dotnet"))


class QueryBoundsException(Exception):
    pass


@region_silo_endpoint
class OrganizationDynamicSamplingSDKVersionsEndpoint(OrganizationEndpoint):
    private = True

    @staticmethod
    def __validate_query_bounds(query_start, query_end):
        if not query_start or not query_end:
            raise QueryBoundsException("'start' and 'end' are required")

        query_start = ensure_aware(parse_date(query_start))
        query_end = ensure_aware(parse_date(query_end))

        if query_start > query_end:
            raise QueryBoundsException("'start' has to be before 'end'")

        if query_end - query_start > timedelta(days=1):
            raise QueryBoundsException("'start' and 'end' have to be a maximum of 1 day apart")

        stats_period = query_end - query_start
        # Quantize time boundary down so that during a 5-minute interval, the query time boundaries
        # remain the same to leverage the snuba cache
        query_end = query_end.replace(
            minute=(query_end.minute - query_end.minute % 5), second=0, microsecond=0
        )
        query_start = query_end - stats_period
        return query_start, query_end

    def get(self, request: Request, organization) -> Response:
        """
        Return a list of project SDK versions based on project filter that are used in the
        organization, and are considered to be the latest according to semantic versioning. It
        also returns information on whether these SDK versions are sending client side sample rates.
        ``````````````````````````````````````````````````

        :pparam string organization_slug: the slug of the organization.
        :qparam array[string] project: A required list of project ids to filter
        :qparam string start: specify a date to begin at. Format must be iso format
        :qparam string end:  specify a date to end at. Format must be iso format
        :auth: required
        """
        if not features.has("organizations:server-side-sampling", organization, actor=request.user):
            return Response(
                {
                    "detail": [
                        "Dynamic sampling feature flag needs to be enabled before you can perform "
                        "this action."
                    ]
                },
                status=404,
            )

        requested_projects = self.get_requested_project_ids_unchecked(request)
        if not requested_projects:
            return Response([])

        project_ids = [
            p.id
            for p in self.get_projects(
                request=request, organization=organization, project_ids=requested_projects
            )
        ]

        try:
            query_start, query_end = self.__validate_query_bounds(
                request.GET.get("start"), request.GET.get("end")
            )
        except QueryBoundsException as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        sample_rate_count_if = 'count_if(trace.client_sample_rate, notEquals, "")'
        avg_sample_rate_equation = f"{sample_rate_count_if} / count()"
        transaction_source_count_if = 'count_if(transaction.source, notEquals, "")'
        avg_transaction_source_equation = f"{transaction_source_count_if} / count()"

        data = discover.query(
            selected_columns=[
                "sdk.name",
                "sdk.version",
                "project",
                sample_rate_count_if,
                transaction_source_count_if,
                "count()",
            ],
            query="event.type:transaction",
            params={
                "start": query_start,
                "end": query_end,
                "project_id": project_ids,
                "organization_id": organization,
            },
            equations=[avg_sample_rate_equation, avg_transaction_source_equation],
            orderby=[],
            offset=0,
            limit=100,
            auto_fields=True,
            auto_aggregations=True,
            allow_metric_aggregates=True,
            use_aggregate_conditions=True,
            transform_alias_to_input_format=True,
            referrer="dynamic-sampling.distribution.fetch-project-sdk-versions-info",
        )["data"]
        # Create a dictionary of the total count per project
        total_count_per_project: Dict[str, int] = {}
        # Create a dictionary of total count per sdk name per project
        total_sdk_name_count_per_project: Dict[Any, Any] = {}
        for row in data:
            project = row["project"]
            sdk_name = row["sdk.name"]
            count = row["count()"]
            # Aggregates total counts for each project
            # As an example: {'wind': 3, 'earth': 49, 'heart': 3, 'fire': 21, 'water': 102}
            total_count_per_project[project] = total_count_per_project.get(project, 0) + count

            # Aggregates total counts for each sdk name per project. As an example:
            # {
            #     "wind": {"sentry.javascript.react": 3},
            #     "earth": {"sentry.javascript.react": 45, "sentry.javascript.browser": 4},
            # }
            total_sdk_name_count_per_project.setdefault(project, {})
            total_sdk_name_count_per_project[project][sdk_name] = (
                total_sdk_name_count_per_project[project].get(sdk_name, 0) + count
            )

        # Creates a dictionary that has the first level key as project id and values (second
        # level key) as SDK versions, and finally that maps to the expected resulting project
        # sdk version info if that SDKVersion was actually the latest observed, and that info
        # contains project, latestSDKVersion, latestSDKName,
        # and two booleans: isSendingSampleRate and isSendingSource
        # which indicates if that SDK version is sending client side sample rate.
        # Example:
        # {
        #     1: {
        #         "1.0.0": {
        #             "project": 1,
        #             "latestSDKVersion": "1.0.0",
        #             "latestSDKName": "Sentry",
        #             "isSendingSampleRate": True,
        #             "isSendingSource": True
        #         },
        #         "1.0.1": {
        #             "project": 1,
        #             "latestSDKVersion": "1.0.1",
        #             "latestSDKName": "Sentry",
        #             "isSendingSampleRate": False,
        #             "isSendingSource": False
        #         }
        #     }
        # }
        project_to_sdk_version_to_info_dict: Dict[Any, Any] = {}
        for row in data:
            project = row["project"]
            sdk_name = (
                row["sdk.name"] or ""
            )  # Defaulting to string just to be sure because we are later using startswith
            sdk_version = row["sdk.version"]
            # Filter 1: Discard any sdk name that accounts less than or equal to the value
            # `SDK_NAME_FILTER_THRESHOLD` of total count per project
            # Filter 2: Discard any sdk version that accounts less than or equal to
            # `SDK_VERSION_FILTER_THRESHOLD` of total count in that sdk_name in that project
            if (
                total_sdk_name_count_per_project[project][sdk_name]
                > SDK_NAME_FILTER_THRESHOLD * total_count_per_project[project]
                and row["count()"]
                > SDK_VERSION_FILTER_THRESHOLD * total_sdk_name_count_per_project[project][sdk_name]
            ):
                project_to_sdk_version_to_info_dict.setdefault(project, {})[sdk_version] = {
                    "project": project,
                    "latestSDKName": sdk_name,
                    "latestSDKVersion": sdk_version,
                    "isSendingSampleRate": bool(row[f"equation|{avg_sample_rate_equation}"]),
                    "isSendingSource": bool(row[f"equation|{avg_transaction_source_equation}"]),
                    "isSupportedPlatform": (sdk_name in ALLOWED_SDK_NAMES)
                    or (sdk_name.startswith(tuple(ALLOWED_SDK_NAMES_PREFIXES))),
                }

        # Essentially for each project, we fetch all the SDK versions from the previously
        # computed dictionary, and then we find the latest SDK version according to
        # semantic versioning and return the info for that particular project SDK version.
        try:
            project_info_list = [
                project_to_sdk_version_to_info_dict[project][
                    max(
                        project_to_sdk_version_to_info_dict[project].keys(),
                        key=cmp_to_key(compare_version_relay),
                    )
                ]
                for project in project_to_sdk_version_to_info_dict
            ]
        except RelayError:
            return Response(
                status=status.HTTP_400_BAD_REQUEST,
                data={
                    "detail": "Unable to parse sdk versions. "
                    "Please check that sdk versions are valid semantic versions."
                },
            )

        return Response(project_info_list)
