from __future__ import absolute_import

import six
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import RelayPermission
from sentry.api.authentication import RelayAuthentication
from sentry.relay.config import Config
from sentry.models import Project, Organization


class RelayProjectConfigsEndpoint(Endpoint):
    authentication_classes = (RelayAuthentication,)
    permission_classes = (RelayPermission,)

    def post(self, request):
        project_ids = request.relay_request_data.get('projects') or ()
        projects = dict.fromkeys(map(six.text_type, project_ids))

        orgs = set()

        if project_ids:
            for project in Project.objects.filter(pk__in=project_ids):
                # TODO: access check for relay
                config = Config(project)
                projects[six.text_type(project.id)] = (
                    project, config.get_project_options(with_org=False))
                orgs.add(project.organization_id)

        if orgs:
            orgs = {o.id: o for o in Organization.objects.filter(pk__in=orgs)}
            for (project, cfg) in list(projects.values()):
                org = orgs.get(project.organization_id)
                if org is None:
                    projects.pop(project.id)
                else:
                    cfg.update(config.get_organization_options(org))

        return Response({
            'configs': {p.id: c for p, c in six.iteritems(projects)}
        }, status=200)
