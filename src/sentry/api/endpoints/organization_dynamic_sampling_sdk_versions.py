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
        start_time = end_time - stats_period

        avg_equation = 'count_if(trace.client_sample_rate, notEquals, "") / count()'

        project_sdks_info = discover.query(
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
        for project_sdk_info in project_sdks_info:
            assert project_sdk_info["sdk.version"] != "", "sdk.version cannot be empty"
            project_to_sdk_version_to_info_dict.setdefault(project_sdk_info["project"], {})[
                project_sdk_info["sdk.version"]
            ] = {
                "project": project_sdk_info["project"],
                "latestSDKName": project_sdk_info["sdk.name"],
                "lastestSDKVersion": project_sdk_info["sdk.version"],
                "isSendingSampleRate": bool(project_sdk_info[f"equation|{avg_equation}"]),
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
