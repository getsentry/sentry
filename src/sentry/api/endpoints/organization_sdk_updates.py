from datetime import timedelta
from itertools import chain, groupby

import sentry_sdk
from django.utils import timezone
from packaging import version
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.utils import handle_query_errors
from sentry.sdk_updates import SdkIndexState, SdkSetupState, get_sdk_index, get_suggested_updates
from sentry.search.events.types import SnubaParams
from sentry.snuba import discover
from sentry.utils.numbers import format_grouped_length


def by_sdk_name(sdk):
    return sdk["sdk.name"]


def by_project_id(sdk):
    return sdk["project.id"]


def serialize(data, projects):
    # filter out SDKs with empty sdk.name or sdk.version or invalid version
    nonempty_sdks = []
    for sdk in data:
        if not sdk["sdk.name"] or not sdk["sdk.version"]:
            continue

        try:
            version.parse(sdk["sdk.version"])
        except version.InvalidVersion:
            continue

        nonempty_sdks.append(sdk)

    # Build datastructure of the latest version of each SDK in use for each
    # project we have events for.
    latest_sdks = chain.from_iterable(
        [
            {
                "projectId": str(project_id),
                "sdkName": sdk_name,
                "sdkVersion": max((s["sdk.version"] for s in sdks), key=version.parse),
            }
            for sdk_name, sdks in groupby(sorted(sdks_used, key=by_sdk_name), key=by_sdk_name)
        ]
        for project_id, sdks_used in groupby(nonempty_sdks, key=by_project_id)
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


@region_silo_endpoint
class OrganizationSdkUpdatesEndpoint(OrganizationEndpoint):
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization) -> Response:
        projects = self.get_projects(request, organization)

        len_projects = len(projects)
        sentry_sdk.set_tag("query.num_projects", len_projects)
        sentry_sdk.set_tag("query.num_projects.grouped", format_grouped_length(len_projects))

        if len(projects) == 0:
            return Response([])

        with handle_query_errors():
            result = discover.query(
                query="has:sdk.version",
                selected_columns=[
                    "project",
                    "project.id",
                    "sdk.name",
                    "sdk.version",
                    "last_seen()",
                ],
                orderby=["-project"],
                snuba_params=SnubaParams(
                    start=timezone.now() - timedelta(days=1),
                    end=timezone.now(),
                    organization=organization,
                    projects=projects,
                ),
                referrer="api.organization-sdk-updates",
            )

        return Response(serialize(result["data"], projects))


@region_silo_endpoint
class OrganizationSdksEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    def get(self, request: Request, organization) -> Response:
        try:
            sdks = get_sdk_index()
        except Exception as e:
            sentry_sdk.capture_exception(e)
            return Response({"detail": "Error occurred while fetching SDKs"}, status=500)

        if len(sdks) == 0:
            raise NotFound(detail="No SDKs found in index")
        return Response(sdks)
