from __future__ import absolute_import

import six
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import RelayPermission
from sentry.api.authentication import RelayAuthentication
from sentry.relay import config
from sentry.models import Project, Organization, OrganizationOption
from sentry.utils import metrics


class RelayProjectConfigsEndpoint(Endpoint):
    authentication_classes = (RelayAuthentication,)
    permission_classes = (RelayPermission,)

    def post(self, request):

        relay = request.relay
        assert relay is not None  # should be provided during Authentication

        full_config_requested = request.relay_request_data.get("fullConfig")

        if full_config_requested and not relay.is_internal:
            return Response("Relay unauthorized for full config information", 403)

        project_ids = set(request.relay_request_data.get("projects") or ())
        if project_ids:
            with metrics.timer("relay_project_configs.fetching_projects.duration"):
                projects = {p.id: p for p in Project.objects.filter(pk__in=project_ids)}
        else:
            projects = {}

        # Preload all organizations and their options to prevent repeated
        # database access when computing the project configuration.
        org_ids = set(project.organization_id for project in six.itervalues(projects))
        if org_ids:
            with metrics.timer("relay_project_configs.fetching_orgs.duration"):
                orgs = {
                    o.id: o
                    for o in Organization.objects.filter(pk__in=org_ids)
                    if request.relay.has_org_access(o)
                }
        else:
            orgs = {}
        org_options = {i: OrganizationOption.objects.get_all_values(i) for i in six.iterkeys(orgs)}

        metrics.timing("relay_project_configs.projects_requested", len(project_ids))
        metrics.timing("relay_project_configs.projects_fetched", len(projects))
        metrics.timing("relay_project_configs.orgs_fetched", len(orgs))

        configs = {}
        for project_id in project_ids:
            configs[six.text_type(project_id)] = None

            project = projects.get(int(project_id))
            if project is None:
                continue

            organization = orgs.get(project.organization_id)
            if organization is None:
                continue

            project.organization = organization
            org_opts = org_options.get(organization.id) or {}

            with metrics.timer("relay_project_configs.get_config.duration"):
                project_config = config.get_project_config(
                    project, org_options=org_opts, full_config=full_config_requested
                )
            configs[six.text_type(project_id)] = project_config.to_camel_case_dict()

        return Response({"configs": configs}, status=200)
