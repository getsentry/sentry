from django.core.exceptions import ValidationError
from django.db import IntegrityError, router, transaction
from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ConflictError
from sentry.api.helpers.slugs import validate_sentry_slug
from sentry.apidocs.constants import RESPONSE_FORBIDDEN
from sentry.apidocs.examples.organization_examples import OrganizationExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.project import Project
from sentry.utils.snowflake import MaxSnowflakeRetryError


@extend_schema(tags=["Organizations"])
@region_silo_endpoint
class SlugsUpdateEndpoint(OrganizationEndpoint):
    owner = ApiOwner.UNOWNED
    publish_status = {
        "PUT": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Update an Origanization's Project Slugs",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=inline_serializer(
            name="UpdateOrgProjectSlugs",
            fields={
                "slugs": serializers.DictField(
                    help_text="a dictionary of project IDs to their intended slugs.", required=False
                ),
            },
        ),
        responses={
            200: inline_sentry_response_serializer("SlugsUpdateResponse", list[str]),
            400: OpenApiResponse(description="Duplicate slugs"),
            403: RESPONSE_FORBIDDEN,
        },
        examples=OrganizationExamples.UPDATE_PROJ_SLUGS,
    )
    def put(self, request: Request, organization) -> Response:
        """
        Update an organization's project slugs.
        """
        slugs = request.data.get("slugs", {})
        for project_id, slug in slugs.items():
            slug = slug.lower()
            try:
                validate_sentry_slug(slug)
            except ValidationError:
                return Response({"detail": 'Invalid slug "%s".' % slug}, status=400)
            slugs[project_id] = slug

        if len(slugs) != len(set(slugs.values())):
            return Response({"detail": "Duplicate slugs"}, status=400)

        project_q = organization.project_set.filter(pk__in=[int(x) for x in slugs])

        rv = {}

        with transaction.atomic(router.db_for_write(Project)):
            try:
                projects = {}

                # Clear out all slugs first so that we can move them
                # around through the uniqueness
                for project in project_q:
                    projects[str(project.id)] = project
                    project.slug = None
                    project.save()

                # Set new ones
                for project_id, slug in slugs.items():
                    project = projects.get(project_id)
                    if project is None:
                        continue
                    other = (
                        Project.objects.filter(slug=slug, organization=organization)
                        .exclude(id=project.id)
                        .first()
                    )
                    if other is not None:
                        if len(slugs) != len(slugs.values()):
                            return Response({"detail": "Duplicate slug %s." % slug}, status=400)
                    project.slug = slug
                    project.update_option("sentry:reviewed-slug", True)
                    project.save()
                    rv[project_id] = slug
            except (IntegrityError, MaxSnowflakeRetryError):
                raise ConflictError(
                    {
                        "detail": f'A project with slug "{slug}" already exists.',
                    }
                )

        return Response({"updated_slugs": rv})
