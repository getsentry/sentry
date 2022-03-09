from datetime import timedelta
from distutils.version import LooseVersion
from itertools import chain, groupby

import sentry_sdk
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases import OrganizationEventsEndpointBase
from sentry.sdk_updates import SdkIndexState, SdkSetupState, get_suggested_updates
from sentry.snuba import discover
from sentry.utils.numbers import format_grouped_length


def by_sdk_name(sdk):
    return sdk["sdk.name"]


def by_project_id(sdk):
    return sdk["project.id"]


def serialize(data, projects):
    # Build datastructure of the latest version of each SDK in use for each
    # project we have events for.
    latest_sdks = chain.from_iterable(
        [
            {
                "projectId": str(project_id),
                "sdkName": sdk_name,
                "sdkVersion": max((s["sdk.version"] for s in sdks), key=LooseVersion),
            }
            for sdk_name, sdks in groupby(sorted(sdks_used, key=by_sdk_name), key=by_sdk_name)
        ]
        for project_id, sdks_used in groupby(data, key=by_project_id)
    )

    # Determine suggested upgrades for each project
    index_state = SdkIndexState()

    updates_list = [
        dict(
            **latest,
            suggestions=list(
                get_suggested_updates(
                    # TODO: In the future it would be nice to also add
                    # the integrations and modules the SDK is using.
                    # However this isn't currently available in the
                    # discover dataset from snuba.
                    SdkSetupState(latest["sdkName"], latest["sdkVersion"], (), ()),
                    index_state,
                    ignore_patch_version=True,
                )
            ),
        )
        for latest in latest_sdks
    ]

    # Filter out SDKs that have no update suggestions
    return [update for update in updates_list if len(update["suggestions"]) > 0]


class OrganizationSdkUpdatesEndpoint(OrganizationEventsEndpointBase):
    def get(self, request: Request, organization) -> Response:
        projects = self.get_projects(request, organization)

        len_projects = len(projects)
        sentry_sdk.set_tag("query.num_projects", len_projects)
        sentry_sdk.set_tag("query.num_projects.grouped", format_grouped_length(len_projects))

        if len(projects) == 0:
            return Response([])

        with self.handle_query_errors():
            result = discover.query(
                query="has:sdk.version",
                selected_columns=[
                    "project",
                    "project.id",
                    "sdk.name",
                    "sdk.version",
                    "last_seen()",
                ],
                orderby="-project",
                params={
                    "start": timezone.now() - timedelta(days=1),
                    "end": timezone.now(),
                    "organization_id": organization.id,
                    "project_id": [p.id for p in projects],
                },
                referrer="api.organization-sdk-updates",
                use_snql=features.has(
                    "organizations:performance-use-snql", organization, actor=request.user
                ),
            )

        return Response(serialize(result["data"], projects))
