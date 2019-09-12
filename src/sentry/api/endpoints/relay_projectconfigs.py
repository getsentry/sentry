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

        relay = request.relay
        assert relay is not None  # should be provided during Authentication

        full_config_requested = request.relay_request_data.get("fullConfig")

        if full_config_requested and not relay.is_internal:
            return Response("Relay unauthorized for full config information", 403)

        project_ids = request.relay_request_data.get("projects") or ()
        projects = {}

        orgs = set()

        # In the first iteration we fetch all configs that we know about
        # but only the project settings
        if project_ids:
            for project in Project.objects.filter(pk__in=project_ids):
                # for internal relays return the full, rich, configuration,
                # for external relays return the minimal config
                proj_config = config.get_project_config(
                    project.id, relay.is_internal and full_config_requested
                )

                projects[six.text_type(project.id)] = proj_config

                orgs.add(project.organization_id)

        # In the second iteration we check if the project has access to
        # the org at all.
        if orgs:
            orgs = {o.id: o for o in Organization.objects.filter(pk__in=orgs)}
            for cfg in list(projects.values()):
                org = orgs.get(cfg.project.organization_id)
                if org is None or not request.relay.has_org_access(org):
                    projects.pop(six.text_type(cfg.project.id))

        # Fill in configs that we failed the access check for or don't
        # exist.
        configs = {p_id: cfg.to_camel_case_dict() for p_id, cfg in six.iteritems(projects)}
        for project_id in project_ids:
            configs.setdefault(six.text_type(project_id), None)

        return Response({"configs": configs}, status=200)
