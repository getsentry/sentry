from __future__ import annotations

import sentry_sdk
from django.db import IntegrityError, router, transaction
from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.analytics.events.release_created import ReleaseCreatedEvent
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.helpers.environments import get_environment
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import ReleaseWithVersionSerializer
from sentry.api.serializers.types import ReleaseSerializerResponse
from sentry.api.utils import get_auth_api_token_type
from sentry.apidocs.constants import (
    RESPONSE_ALREADY_REPORTED,
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.release_examples import ReleaseExamples
from sentry.apidocs.parameters import (
    CursorQueryParam,
    GlobalParams,
    ReleaseParams,
    VisibilityParams,
)
from sentry.apidocs.response_types import ValidationErrorResponse, as_validation_errors
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.activity import Activity
from sentry.models.environment import Environment
from sentry.models.orgauthtoken import is_org_auth_token_auth, update_org_auth_token_last_used
from sentry.models.release import Release, ReleaseStatus
from sentry.plugins.interfaces.releasehook import ReleaseHook
from sentry.ratelimits.config import SENTRY_RATELIMITER_GROUP_DEFAULTS, RateLimitConfig
from sentry.signals import release_created
from sentry.types.activity import ActivityType
from sentry.utils.sdk import bind_organization_context


@extend_schema(tags=["Releases"])
@cell_silo_endpoint
class ProjectReleasesEndpoint(ProjectEndpoint):
    owner = ApiOwner.COMMUNITY
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectReleasePermission,)
    rate_limits = RateLimitConfig(
        group="CLI", limit_overrides={"GET": SENTRY_RATELIMITER_GROUP_DEFAULTS["default"]}
    )

    @extend_schema(
        operation_id="listProjectReleases",
        summary="List a Project's Releases",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            GlobalParams.ENVIRONMENT,
            ReleaseParams.QUERY,
            VisibilityParams.PER_PAGE,
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListProjectReleasesResponse", list[ReleaseSerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ReleaseExamples.LIST_PROJECT_RELEASES,
    )
    def get(self, request: Request, project) -> Response[list[ReleaseSerializerResponse]]:
        """
        Retrieve a list of releases for a given project.
        """
        query = request.GET.get("query")
        try:
            environment = get_environment(request, project.organization_id)
        except Environment.DoesNotExist:
            queryset = Release.objects.none()
            environment = None
        else:
            queryset = Release.objects.filter(
                projects=project,
                organization_id=project.organization_id,
            ).filter(Q(status=ReleaseStatus.OPEN) | Q(status=None))
            if environment is not None:
                queryset = queryset.filter(
                    releaseprojectenvironment__project=project,
                    releaseprojectenvironment__environment=environment,
                )

        if query:
            queryset = queryset.filter(version__icontains=query)

        return self.paginate(
            request=request,
            queryset=queryset.extra(select={"sort": "COALESCE(date_released, date_added)"}),
            order_by="-sort",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x, request.user, project=project, environment=environment
            ),
        )

    @extend_schema(
        operation_id="Create a New Release for a Project",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        request=ReleaseWithVersionSerializer,
        responses={
            201: inline_sentry_response_serializer(
                "CreateProjectReleaseResponse", ReleaseSerializerResponse
            ),
            208: RESPONSE_ALREADY_REPORTED,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
        },
        examples=ReleaseExamples.CREATE_RELEASE,
    )
    def post(
        self, request: Request, project
    ) -> Response[ReleaseSerializerResponse] | Response[ValidationErrorResponse]:
        """
        Create a new release and/or associate a project with a release. Releases are used by
        Sentry to improve error reporting by correlating first-seen events with the release
        that may have introduced them, and are required for source maps and other debug
        features.

        Release versions that are the same across multiple projects within an organization
        are treated as the same release in Sentry.
        """
        bind_organization_context(project.organization)
        serializer = ReleaseWithVersionSerializer(
            data=request.data, context={"organization": project.organization}
        )

        scope = sentry_sdk.get_isolation_scope()

        if serializer.is_valid():
            result = serializer.validated_data
            scope.set_tag("version", result["version"])
            scope.set_attribute("version", result["version"])

            new_status = result.get("status")

            # release creation is idempotent to simplify user
            # experiences
            owner_id: int | None = None
            if owner := result.get("owner"):
                owner_id = owner.id

            try:
                with transaction.atomic(router.db_for_write(Release)):
                    release, created = (
                        Release.objects.create(
                            organization_id=project.organization_id,
                            version=result["version"],
                            ref=result.get("ref"),
                            url=result.get("url"),
                            owner_id=owner_id,
                            date_released=result.get("dateReleased"),
                            status=new_status or ReleaseStatus.OPEN,
                            user_agent=request.META.get("HTTP_USER_AGENT", ""),
                        ),
                        True,
                    )
                was_released = False
            except IntegrityError:
                release, created = (
                    Release.objects.get(
                        organization_id=project.organization_id, version=result["version"]
                    ),
                    False,
                )
                was_released = bool(release.date_released)
            else:
                release_created.send_robust(release=release, sender=self.__class__)

            if not created and new_status is not None and new_status != release.status:
                release.status = new_status
                release.save()

            _, releaseproject_created = release.add_project(project)

            commit_list = result.get("commits")
            if commit_list:
                hook = ReleaseHook(project)
                # TODO(dcramer): handle errors with release payloads
                hook.set_commits(release.version, commit_list)

            if not was_released and release.date_released:
                Activity.objects.create(
                    type=ActivityType.RELEASE.value,
                    project=project,
                    ident=Activity.get_version_ident(result["version"]),
                    data={"version": result["version"]},
                    datetime=release.date_released,
                )

            if not releaseproject_created:
                # This is the closest status code that makes sense, and we want
                # a unique 2xx response code so people can understand when
                # behavior differs.
                #   208 Already Reported (WebDAV; RFC 5842)
                status = 208
            else:
                status = 201

            analytics.record(
                ReleaseCreatedEvent(
                    user_id=request.user.id if request.user and request.user.id else None,
                    organization_id=project.organization_id,
                    project_ids=[project.id],
                    user_agent=request.META.get("HTTP_USER_AGENT", "")[:256],
                    created_status=status,
                    auth_type=get_auth_api_token_type(request.auth),
                )
            )

            if is_org_auth_token_auth(request.auth):
                update_org_auth_token_last_used(request.auth, [project.id])

            scope.set_tag("success_status", status)
            scope.set_attribute("success_status", status)

            # Disable snuba here as it often causes 429s when overloaded and
            # a freshly created release won't have health data anyways.
            data: ReleaseSerializerResponse = serialize(
                release, request.user, no_snuba_for_release_creation=True
            )
            return Response(data, status=status)
        scope.set_tag("failure_reason", "serializer_error")
        scope.set_attribute("failure_reason", "serializer_error")
        return Response(as_validation_errors(serializer), status=400)
