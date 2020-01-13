from __future__ import absolute_import

import logging
import six
from rest_framework.response import Response

from sentry_sdk import Hub
from sentry_sdk.tracing import Span

from sentry.api.base import Endpoint
from sentry.api.permissions import RelayPermission
from sentry.api.authentication import RelayAuthentication
from sentry.relay import config
from sentry.models import Project, ProjectKey, Organization, OrganizationOption
from sentry.utils import metrics, json

logger = logging.getLogger(__name__)

# We'll log project IDS if their config size is larger than this value
PROJECT_CONFIG_SIZE_THRESHOLD = 10000


class RelayProjectConfigsEndpoint(Endpoint):
    authentication_classes = (RelayAuthentication,)
    permission_classes = (RelayPermission,)

    def post(self, request):
        with Hub.current.start_span(
            Span(op="http.server", transaction="RelayProjectConfigsEndpoint", sampled=True)
        ):
            return self._post(request)

    def _post(self, request):
        relay = request.relay
        assert relay is not None  # should be provided during Authentication

        full_config_requested = request.relay_request_data.get("fullConfig")

        if full_config_requested and not relay.is_internal:
            return Response("Relay unauthorized for full config information", 403)

        with Hub.current.start_span(op="relay_fetch_projects"):
            project_ids = set(request.relay_request_data.get("projects") or ())
            if project_ids:
                with metrics.timer("relay_project_configs.fetching_projects.duration"):
                    projects = {p.id: p for p in Project.objects.get_many_from_cache(project_ids)}
            else:
                projects = {}

        with Hub.current.start_span(op="relay_fetch_orgs"):
            # Preload all organizations and their options to prevent repeated
            # database access when computing the project configuration.
            org_ids = set(project.organization_id for project in six.itervalues(projects))
            if org_ids:
                with metrics.timer("relay_project_configs.fetching_orgs.duration"):
                    orgs = {
                        o.id: o
                        for o in Organization.objects.get_many_from_cache(org_ids)
                        if request.relay.has_org_access(o)
                    }
            else:
                orgs = {}
            org_options = {
                i: OrganizationOption.objects.get_all_values(i) for i in six.iterkeys(orgs)
            }

        with Hub.current.start_span(op="relay_fetch_keys"):
            project_keys = {}
            for key in ProjectKey.objects.get_many_from_cache(project_ids, key="project_id"):
                project_keys.setdefault(key.project_id, []).append(key)

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

            # Try to prevent organization from being fetched again in quotas.
            project.organization = organization
            project._organization_cache = organization

            org_opts = org_options.get(organization.id) or {}

            with Hub.current.start_span(op="get_config"):
                with metrics.timer("relay_project_configs.get_config.duration"):
                    project_config = config.get_project_config(
                        project,
                        org_options=org_opts,
                        full_config=full_config_requested,
                        project_keys=project_keys.get(project.id, []),
                    )

            configs[six.text_type(project_id)] = serialized_config = project_config.to_dict()
            config_size = len(json.dumps(serialized_config))
            metrics.timing("relay_project_configs.config_size", config_size)

            # Log if we see huge project configs
            if config_size >= PROJECT_CONFIG_SIZE_THRESHOLD:
                logger.info(
                    "relay.project_config.huge_config",
                    extra={"project_id": project_id, "size": config_size},
                )

        return Response({"configs": configs}, status=200)
