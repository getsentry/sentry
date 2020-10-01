from __future__ import absolute_import

import random
import logging
import six
from rest_framework.response import Response

from django.conf import settings

from sentry_sdk import Hub

from sentry.api.base import Endpoint
from sentry.api.permissions import RelayPermission
from sentry.api.authentication import RelayAuthentication
from sentry.relay import config, projectconfig_cache
from sentry.models import Project, ProjectKey, Organization, OrganizationOption
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# We'll log project IDS if their config size is larger than this value
PROJECT_CONFIG_SIZE_THRESHOLD = 10000


def _sample_apm():
    return random.random() < getattr(settings, "SENTRY_RELAY_ENDPOINT_APM_SAMPLING", 0)


class RelayProjectConfigsEndpoint(Endpoint):
    authentication_classes = (RelayAuthentication,)
    permission_classes = (RelayPermission,)

    def post(self, request):
        with Hub.current.start_transaction(
            op="http.server", name="RelayProjectConfigsEndpoint", sampled=_sample_apm(),
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
                    orgs = Organization.objects.get_many_from_cache(org_ids)
                    orgs = {o.id: o for o in orgs if request.relay.has_org_access(o)}
            else:
                orgs = {}

            with metrics.timer("relay_project_configs.fetching_org_options.duration"):
                for org_id in six.iterkeys(orgs):
                    OrganizationOption.objects.get_all_values(org_id)

        project_keys = {}
        with Hub.current.start_span(op="relay_fetch_keys"):
            for key in ProjectKey.objects.filter(project_id__in=project_ids):
                project_keys.setdefault(key.project_id, []).append(key)
        with Hub.current.start_span(op="relay_fetch_keys"):
            for key in ProjectKey.objects.filter(redirect_set__from_project_id__in=project_ids):
                project_keys.setdefault(key.project_id, []).append(key)

        metrics.timing("relay_project_configs.projects_requested", len(project_ids))
        metrics.timing("relay_project_configs.projects_fetched", len(projects))
        metrics.timing("relay_project_configs.orgs_fetched", len(orgs))

        configs = {}
        for project_id in project_ids:
            configs[six.text_type(project_id)] = {"disabled": True}

            project = projects.get(int(project_id))
            if project is None:
                # TODO: Check if the request is for a redirect DSN.
                continue

            organization = orgs.get(project.organization_id)
            if organization is None:
                continue

            # Try to prevent organization from being fetched again in quotas.
            project.organization = organization
            project._organization_cache = organization

            with Hub.current.start_span(op="get_config"):
                with metrics.timer("relay_project_configs.get_config.duration"):
                    project_config = config.get_project_config(
                        project,
                        full_config=full_config_requested,
                        project_keys=project_keys.get(project.id) or [],
                    )

            configs[six.text_type(project_id)] = project_config.to_dict()

        if full_config_requested:
            projectconfig_cache.set_many(configs)

        return Response({"configs": configs}, status=200)
