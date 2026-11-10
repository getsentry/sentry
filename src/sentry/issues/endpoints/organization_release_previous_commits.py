from typing import TypedDict

import sentry_sdk
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.analytics.events.release_get_previous_commits import ReleaseGetPreviousCommitsEvent
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import DEFAULT_DURATION_BUDGET, cell_silo_endpoint
from sentry.api.bases.organization import NoProjects, OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.types import ReleaseSerializerResponse
from sentry.apidocs.constants import (
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.release_examples import ReleaseExamples
from sentry.apidocs.parameters import GlobalParams, OrganizationParams, ReleaseParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.principal import acting_user_id
from sentry.models.organization import Organization
from sentry.models.release import Release
from sentry.models.releases.release_project import ReleaseProject
from sentry.ratelimits.config import RateLimitConfig


class NoPreviousReleaseResponse(TypedDict):
    """No release with commits was found."""


@extend_schema(tags=["Releases"])
@cell_silo_endpoint
class OrganizationReleasePreviousCommitsEndpoint(OrganizationReleasesBaseEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ISSUES
    max_acceptable_duration = DEFAULT_DURATION_BUDGET
    rate_limits = RateLimitConfig(group="CLI")

    @extend_schema(
        operation_id="getOrganizationPreviousReleaseWithCommits",
        summary="Retrieve an Organization's Previous Release with Commits",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            ReleaseParams.VERSION,
            OrganizationParams.PROJECT,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "PreviousReleaseWithCommitsResponse",
                ReleaseSerializerResponse | NoPreviousReleaseResponse,
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ReleaseExamples.RETRIEVE_PREVIOUS_RELEASE_WITH_COMMITS,
    )
    def get(
        self, request: Request, organization: Organization, version: str
    ) -> Response[ReleaseSerializerResponse | NoPreviousReleaseResponse]:
        """
        Return the most recent release with commits that was released at or before the given
        release, in the same projects. The given release is returned when it has commits
        itself. Pass `project` to narrow the search to some of the release's projects.

        Returns an empty object when there's no such release, or when none of the requested
        projects are accessible. `firstEvent` and `lastEvent` are always null.
        """
        try:
            release = Release.objects.get(organization_id=organization.id, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        start_date = release.date_released or release.date_added

        try:
            filter_params = self.get_filter_params(request, organization)
        except NoProjects:
            # Returning 200 to conform to existing behavior. It would be much better to 404
            # here and handle it in the client.
            return Response({}, status=200)

        # Release-related project-ids are pre-fetched and narrowed by the request parameters. If
        # you want the previous release but you specify a list of project-ids you likely don't
        # want a release from another project entirely!
        project_ids = list(
            ReleaseProject.objects.filter(
                release_id=release.id,
                project_id__in=filter_params["project_id"],
            ).values_list("project_id", flat=True)
        )

        prev_release_with_commits = (
            Release.objects.filter(
                organization_id=organization.id,
                projects__id__in=project_ids,
                last_commit_id__isnull=False,
            )
            .extra(
                select={"date": "COALESCE(date_released, date_added)"},
                where=["COALESCE(date_released, date_added) <= %s"],
                params=[start_date],
            )
            .extra(order_by=["-date"])[:1]
        )

        try:
            analytics.record(
                ReleaseGetPreviousCommitsEvent(
                    user_id=acting_user_id(request.user),
                    organization_id=organization.id,
                    project_ids=project_ids,
                    user_agent=request.META.get("HTTP_USER_AGENT", ""),
                )
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)

        if not prev_release_with_commits:
            return Response({})

        data: ReleaseSerializerResponse = serialize(
            prev_release_with_commits[0],
            request.user,
            # sentry-cli only reads lastCommit, skip the Snuba lookup for first/last seen
            skip_snuba=True,
        )
        return Response(data)
