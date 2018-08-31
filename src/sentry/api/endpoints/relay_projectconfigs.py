from __future__ import absolute_import

import six
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import RelayPermission
from sentry.api.authentication import RelayAuthentication
from sentry.relay import config
from sentry.models import Project, Organization


class RelayProjectConfigsEndpoint(Endpoint):
    authentication_classes = (RelayAuthentication,)
    permission_classes = (RelayPermission,)

    def post(self, request):
        project_ids = request.relay_request_data.get('projects') or ()
        projects = {}

        orgs = set()

        # In the first iteration we fetch all configs that we know about
        # but only the project settings
        if project_ids:
            for project in Project.objects.filter(pk__in=project_ids):
                projects[six.text_type(project.id)] = (
                    project, config.get_project_options(project))
                orgs.add(project.organization_id)

        # In the second iteration we check if the project has access to
        # the org at all.
        if orgs:
            orgs = {o.id: o for o in Organization.objects.filter(pk__in=orgs)}
            for (project, cfg) in list(projects.values()):
                org = orgs.get(project.organization_id)
                if org is None or not request.relay.has_org_access(org):
                    projects.pop(six.text_type(project.id))

        # Fill in configs that we failed the access check for or don't
        # exist.
        configs = {p_id: c[1] for p_id, c in six.iteritems(projects)}
        for project_id in project_ids:
            configs.setdefault(six.text_type(project_id), None)

        return Response({
            'configs': configs,
        }, status=200)
