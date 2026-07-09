import sentry_sdk
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import ReleaseAnalyticsMixin, cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.endpoints.organization_releases import get_stats_period_detail
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import ReleaseSerializer
from sentry.api.serializers.types import ReleaseSerializerResponse
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.release_examples import ReleaseExamples
from sentry.apidocs.parameters import GlobalParams, ReleaseParams
from sentry.apidocs.response_types import ValidationErrorResponse, as_validation_errors
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.activity import Activity
from sentry.models.release import Release
from sentry.models.releases.exceptions import UnsafeReleaseDeletion
from sentry.plugins.interfaces.releasehook import ReleaseHook
from sentry.snuba.sessions import STATS_PERIODS
from sentry.types.activity import ActivityType
from sentry.utils.sdk import bind_organization_context


@extend_schema(tags=["Releases"])
@cell_silo_endpoint
class ProjectReleaseDetailsEndpoint(ProjectEndpoint, ReleaseAnalyticsMixin):
    owner = ApiOwner.COMMUNITY
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectReleasePermission,)

    @extend_schema(
        operation_id="Retrieve a Project's Release",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ReleaseParams.VERSION,
            ReleaseParams.SUMMARY_STATS_PERIOD,
            ReleaseParams.HEALTH_STATS_PERIOD,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ProjectReleaseResponse", ReleaseSerializerResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ReleaseExamples.RETRIEVE_RELEASE,
    )
    def get(self, request: Request, project, version) -> Response[ReleaseSerializerResponse]:
        """
        Return details on an individual release.
        """
        with_health = request.GET.get("health") == "1"
        summary_stats_period = request.GET.get("summaryStatsPeriod") or "14d"
        health_stats_period = request.GET.get("healthStatsPeriod") or ("24h" if with_health else "")
        if summary_stats_period not in STATS_PERIODS:
            raise ParseError(detail=get_stats_period_detail("summaryStatsPeriod", STATS_PERIODS))
        if health_stats_period and health_stats_period not in STATS_PERIODS:
            raise ParseError(detail=get_stats_period_detail("healthStatsPeriod", STATS_PERIODS))

        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if with_health:
            release._for_project_id = project.id

        data: ReleaseSerializerResponse = serialize(
            release,
            request.user,
            project=project,
            with_health_data=with_health,
            summary_stats_period=summary_stats_period,
            health_stats_period=health_stats_period,
        )
        return Response(data)

    @extend_schema(
        operation_id="Update a Project's Release",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ReleaseParams.VERSION,
        ],
        request=ReleaseSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "UpdateProjectReleaseResponse", ReleaseSerializerResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(
        self, request: Request, project, version
    ) -> Response[ReleaseSerializerResponse] | Response[ValidationErrorResponse]:
        """
        Update a release. This can change metadata associated with the release
        (its ref, url, dates, and status) and associate commits with it.
        """
        bind_organization_context(project.organization)
        scope = sentry_sdk.get_isolation_scope()
        scope.set_tag("version", version)
        scope.set_attribute("version", version)
        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            scope.set_tag("failure_reason", "Release.DoesNotExist")
            scope.set_attribute("failure_reason", "Release.DoesNotExist")
            raise ResourceDoesNotExist

        serializer = ReleaseSerializer(data=request.data, partial=True)

        if not serializer.is_valid():
            scope.set_tag("failure_reason", "serializer_error")
            scope.set_attribute("failure_reason", "serializer_error")
            return Response(as_validation_errors(serializer), status=400)

        result = serializer.validated_data

        was_released = bool(release.date_released)

        kwargs = {}
        if result.get("dateReleased"):
            kwargs["date_released"] = result["dateReleased"]
        if result.get("ref"):
            kwargs["ref"] = result["ref"]
        if result.get("url"):
            kwargs["url"] = result["url"]
        if result.get("status"):
            kwargs["status"] = result["status"]

        if kwargs:
            release.update(**kwargs)

        commit_list = result.get("commits")
        if commit_list:
            hook = ReleaseHook(project)
            # TODO(dcramer): handle errors with release payloads
            hook.set_commits(release.version, commit_list)
            self.track_set_commits_local(
                request, organization_id=project.organization_id, project_ids=[project.id]
            )

        if not was_released and release.date_released:
            Activity.objects.create(
                type=ActivityType.RELEASE.value,
                project=project,
                ident=Activity.get_version_ident(release.version),
                data={"version": release.version},
                datetime=release.date_released,
            )
        no_snuba_for_release_creation = options.get("releases.no_snuba_for_release_creation")
        body: ReleaseSerializerResponse = serialize(
            release, request.user, no_snuba_for_release_creation=no_snuba_for_release_creation
        )
        return Response(body)

    @extend_schema(
        operation_id="Delete a Project's Release",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ReleaseParams.VERSION,
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, project, version) -> Response:
        """
        Permanently remove a release and all of its files.
        """
        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        try:
            release.safe_delete()
        except UnsafeReleaseDeletion as e:
            return Response({"detail": str(e)}, status=400)

        return Response(status=204)
