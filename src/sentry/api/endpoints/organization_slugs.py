from django.core.validators import ValidationError, validate_slug
from django.db import transaction
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models import Project


class SlugsUpdateEndpoint(OrganizationEndpoint):
    def put(self, request, organization):
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
                validate_slug(slug)
            except ValidationError:
                return Response({"detail": 'invalid slug "%s"' % slug}, status=400)
            slugs[project_id] = slug

        if len(slugs) != len(set(slugs.values())):
            return Response({"detail": "Duplicate slugs"}, status=400)

        project_q = organization.project_set.filter(pk__in=[int(x) for x in slugs])

        rv = {}

        with transaction.atomic():
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
                        return Response({"detail": "Duplicate slug %s" % slug}, status=400)
                project.slug = slug
                project.update_option("sentry:reviewed-slug", True)
                project.save()
                rv[project_id] = slug

        return Response({"updated_slugs": rv})
