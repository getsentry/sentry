from datetime import timedelta
from functools import cmp_to_key

from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_relay.processing import compare_version as compare_version_relay

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.snuba import discover
from sentry.utils.dates import parse_stats_period

SDK_NAME_FILTER_THRESHOLD = 0.1
SDK_VERSION_FILTER_THRESHOLD = 0.05


class OrganizationDynamicSamplingSDKVersionsEndpoint(OrganizationEndpoint):
    private = True

    def get(self, request: Request, organization) -> Response:
        """
        Return a list of project SDK versions based on project filter that are used in the
        organization, and are considered to be the latest according to semantic versioning. It
        also returns information on whether these SDK versions are sending client side sample rates.
        ``````````````````````````````````````````````````

        :pparam string organization_slug: the slug of the organization.
        :qparam array[string] project: A required list of project ids to filter
        :qparam string statsPeriod: an optional stat period (can be one of
                                    ``"24h"``, ``"14d"``, and ``""``).
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

        stats_period = min(
            parse_stats_period(request.GET.get("statsPeriod", "24h")), timedelta(days=2)
        )

        end_time = timezone.now()
        # Quantize time boundary down so that during a 5-minute interval, the query time boundaries
        # remain the same to leverage the snuba cache
        end_time = end_time.replace(
            minute=(end_time.minute - end_time.minute % 5), second=0, microsecond=0
        )
        start_time = end_time - stats_period

        avg_equation = 'count_if(trace.client_sample_rate, notEquals, "") / count()'

        data = discover.query(
            selected_columns=[
                "sdk.name",
                "sdk.version",
                "project",
                'count_if(trace.client_sample_rate, notEquals, "")',
                "count()",
            ],
            query="event.type:transaction",
            params={
                "start": start_time,
                "end": end_time,
                "project_id": project_ids,
                "organization_id": organization,
            },
            equations=[avg_equation],
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
        total_count_per_project = {}
        # Create a dictionary of total count per sdk name per project
        total_sdk_name_count_per_project = {}
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
        # contains project, latestSDKVersion, latestSDKName, and a boolean isSendingSampleRate
        # which indicates if that SDK version is sending client side sample rate.
        # Example:
        # {
        #     1: {
        #         "1.0.0": {
        #             "project": 1,
        #             "latestSDKVersion": "1.0.0",
        #             "latestSDKName": "Sentry",
        #             "isSendingSampleRate": True
        #         },
        #         "1.0.1": {
        #             "project": 1,
        #             "latestSDKVersion": "1.0.1",
        #             "latestSDKName": "Sentry",
        #             "isSendingSampleRate": False
        #         }
        #     }
        # }
        project_to_sdk_version_to_info_dict = {}
        for row in data:
            project = row["project"]
            sdk_name = row["sdk.name"]
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
                    "isSendingSampleRate": bool(row[f"equation|{avg_equation}"]),
                }

        # Essentially for each project, we fetch all the SDK versions from the previously
        # computed dictionary, and then we find the latest SDK version according to
        # semantic versioning and return the info for that particular project SDK version.
        project_info_list = [
            project_to_sdk_version_to_info_dict[project][
                sorted(
                    list(project_to_sdk_version_to_info_dict[project].keys()),
                    key=cmp_to_key(compare_version_relay),
                )[-1]
            ]
            for project in project_to_sdk_version_to_info_dict
        ]

        return Response(project_info_list)
