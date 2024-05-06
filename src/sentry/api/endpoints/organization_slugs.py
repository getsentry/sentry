from django.core.exceptions import ValidationError
from django.db import IntegrityError, router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ConflictError
from sentry.api.helpers.slugs import validate_sentry_slug
from sentry.models.project import Project
from sentry.utils.snowflake import MaxSnowflakeRetryError


@region_silo_endpoint
class SlugsUpdateEndpoint(OrganizationEndpoint):
    publish_status = {
        "PUT": ApiPublishStatus.UNKNOWN,
    }

    def put(self, request: Request, organization) -> Response:
        """
        Update Project Slugs
        ````````````````````

        Updates the slugs of projects within the organization.

        :pparam string organization_slug: the slug of the organization the
                                          short ID should be looked up in.
        :param slugs: a dictionary of project IDs to their intended slugs.
        :auth: required
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
