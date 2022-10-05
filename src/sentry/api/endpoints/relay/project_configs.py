import logging
import random
from typing import Optional

from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import Hub, set_tag, start_span, start_transaction

from sentry.api.authentication import RelayAuthentication
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.permissions import RelayPermission
from sentry.models import Organization, OrganizationOption, Project, ProjectKey, ProjectKeyStatus
from sentry.relay import config, projectconfig_cache
from sentry.tasks.relay import schedule_build_project_config
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# We'll log project IDS if their config size is larger than this value
PROJECT_CONFIG_SIZE_THRESHOLD = 10000


def _sample_apm():
    return random.random() < getattr(settings, "SENTRY_RELAY_ENDPOINT_APM_SAMPLING", 0)


@region_silo_endpoint
class RelayProjectConfigsEndpoint(Endpoint):
    authentication_classes = (RelayAuthentication,)
    permission_classes = (RelayPermission,)
    enforce_rate_limit = False

    def post(self, request: Request) -> Response:
        with start_transaction(
            op="http.server", name="RelayProjectConfigsEndpoint", sampled=_sample_apm()
        ):
            return self._post(request)

    def _post(self, request: Request):
        relay = request.relay
        assert relay is not None  # should be provided during Authentication

        full_config_requested = request.relay_request_data.get("fullConfig")

        if full_config_requested and not relay.is_internal:
            return Response("Relay unauthorized for full config information", 403)

        version = request.GET.get("version") or "1"
        set_tag("relay_protocol_version", version)

        if self._should_use_v3(version, request):
            # Always compute the full config. It's invalid to send partial
            # configs to processing relays, and these validate the requests they
            # get with permissions and trim configs down accordingly.
            return self._post_or_schedule_by_key(request)
        elif version in ["2", "3"]:
            return self._post_by_key(
                request=request,
                full_config_requested=full_config_requested,
            )
        elif version == "1":
            return self._post_by_project(
                request=request,
                full_config_requested=full_config_requested,
            )
        else:
            return Response("Unsupported version, we only support versions 1 to 3.", 400)

    def _should_use_v3(self, version, request):
        set_tag("relay_endpoint_version", version)
        no_cache = request.relay_request_data.get("noCache") or False
        set_tag("relay_no_cache", no_cache)
        is_full_config = request.relay_request_data.get("fullConfig")
        set_tag("relay_full_config", is_full_config)

        use_v3 = True
        reason = "version"

        if version != "3":
            use_v3 = False
            reason = "version"
        elif not is_full_config:
            # The v3 implementation can't handle partial configs. Relay by
            # default request full configs and the amount of partial configs
            # should be low, so we handle them per request instead of
            # considering them v3.
            use_v3 = False
            reason = "fullConfig"
            version = "2"  # Downgrade to 2 for reporting metrics
        elif no_cache:
            use_v3 = False
            reason = "noCache"
            version = "2"  # Downgrade to 2 for reporting metrics

        set_tag("relay_use_v3", use_v3)
        set_tag("relay_use_v3_rejected", reason)
        if version == "2":
            metrics.incr(
                "api.endpoints.relay.project_configs.post",
                tags={"version": version, "reason": reason},
                sample_rate=1.0,
            )
        else:
            metrics.incr(
                "api.endpoints.relay.project_configs.post",
                tags={"version": version, "reason": reason},
            )

        return use_v3

    def _post_or_schedule_by_key(self, request: Request):
        public_keys = set(request.relay_request_data.get("publicKeys") or ())

        proj_configs = {}
        pending = []
        for key in public_keys:
            computed = self._get_cached_or_schedule(key)
            if not computed:
                pending.append(key)
            else:
                proj_configs[key] = computed

        metrics.incr("relay.project_configs.post_v3.pending", amount=len(pending))
        metrics.incr("relay.project_configs.post_v3.fetched", amount=len(proj_configs))
        res = {"configs": proj_configs, "pending": pending}

        return Response(res, status=200)

    def _get_cached_or_schedule(self, public_key) -> Optional[dict]:
        """
        Returns the config of a project if it's in the cache; else, schedules a
        task to compute and write it into the cache.

        Debouncing of the project happens after the task has been scheduled.
        """
        cached_config = projectconfig_cache.get(public_key)
        if cached_config:
            return cached_config

        schedule_build_project_config(public_key=public_key)
        return None

    def _post_by_key(self, request: Request, full_config_requested):
        public_keys = request.relay_request_data.get("publicKeys")
        public_keys = set(public_keys or ())

        project_keys = {}  # type: dict[str, ProjectKey]
        project_ids = set()  # type: set[int]

        with start_span(op="relay_fetch_keys"):
            with metrics.timer("relay_project_configs.fetching_keys.duration"):
                for key in ProjectKey.objects.get_many_from_cache(public_keys, key="public_key"):
                    if key.status != ProjectKeyStatus.ACTIVE:
                        continue

                    project_keys[key.public_key] = key
                    project_ids.add(key.project_id)

        projects = {}  # type: dict[int, Project]
        organization_ids = set()  # type: set[int]

        with start_span(op="relay_fetch_projects"):
            with metrics.timer("relay_project_configs.fetching_projects.duration"):
                for project in Project.objects.get_many_from_cache(project_ids):
                    projects[project.id] = project
                    organization_ids.add(project.organization_id)

        # Preload all organizations and their options to prevent repeated
        # database access when computing the project configuration.

        orgs = {}  # type: dict[int, Organization]

        with start_span(op="relay_fetch_orgs"):
            with metrics.timer("relay_project_configs.fetching_orgs.duration"):
                for org in Organization.objects.get_many_from_cache(organization_ids):
                    if request.relay.has_org_access(org):
                        orgs[org.id] = org

        with start_span(op="relay_fetch_org_options"):
            with metrics.timer("relay_project_configs.fetching_org_options.duration"):
                for org_id in orgs:
                    OrganizationOption.objects.get_all_values(org_id)

        metrics.timing("relay_project_configs.projects_requested", len(project_ids))
        metrics.timing("relay_project_configs.projects_fetched", len(projects))
        metrics.timing("relay_project_configs.orgs_fetched", len(orgs))

        configs = {}
        for public_key in public_keys:
            configs[public_key] = {"disabled": True}

            key = project_keys.get(public_key)
            if key is None:
                continue

            project = projects.get(key.project_id)
            if project is None:
                continue

            organization = orgs.get(project.organization_id)
            if organization is None:
                continue

            # Prevent organization from being fetched again in quotas.
            project.set_cached_field_value("organization", organization)

            with Hub.current.start_span(op="get_config"):
                with metrics.timer("relay_project_configs.get_config.duration"):
                    project_config = config.get_project_config(
                        project,
                        full_config=full_config_requested,
                        project_keys=[key],
                    )

            configs[public_key] = project_config.to_dict()

        if full_config_requested:
            projectconfig_cache.set_many(configs)

        return Response({"configs": configs}, status=200)

    def _post_by_project(self, request: Request, full_config_requested):
        project_ids = set(request.relay_request_data.get("projects") or ())

        with start_span(op="relay_fetch_projects"):
            if project_ids:
                with metrics.timer("relay_project_configs.fetching_projects.duration"):
                    projects = {p.id: p for p in Project.objects.get_many_from_cache(project_ids)}
            else:
                projects = {}

        with start_span(op="relay_fetch_orgs"):
            # Preload all organizations and their options to prevent repeated
            # database access when computing the project configuration.
            org_ids = {project.organization_id for project in projects.values()}
            if org_ids:
                with metrics.timer("relay_project_configs.fetching_orgs.duration"):
                    orgs = Organization.objects.get_many_from_cache(org_ids)
                    orgs = {o.id: o for o in orgs if request.relay.has_org_access(o)}
            else:
                orgs = {}

            with metrics.timer("relay_project_configs.fetching_org_options.duration"):
                for org_id in orgs.keys():
                    OrganizationOption.objects.get_all_values(org_id)

        with start_span(op="relay_fetch_keys"):
            project_keys = {}
            for key in ProjectKey.objects.filter(project_id__in=project_ids):
                project_keys.setdefault(key.project_id, []).append(key)

        metrics.timing("relay_project_configs.projects_requested", len(project_ids))
        metrics.timing("relay_project_configs.projects_fetched", len(projects))
        metrics.timing("relay_project_configs.orgs_fetched", len(orgs))

        configs = {}
        for project_id in project_ids:
            configs[str(project_id)] = {"disabled": True}

            project = projects.get(int(project_id))
            if project is None:
                continue

            organization = orgs.get(project.organization_id)
            if organization is None:
                continue

            # Prevent organization from being fetched again in quotas.
            project.set_cached_field_value("organization", organization)

            with start_span(op="get_config"):
                with metrics.timer("relay_project_configs.get_config.duration"):
                    project_config = config.get_project_config(
                        project,
                        full_config=full_config_requested,
                        project_keys=project_keys.get(project.id) or [],
                    )

            configs[str(project_id)] = project_config.to_dict()

        if full_config_requested:
            projectconfig_cache.set_many(configs)

        return Response({"configs": configs}, status=200)
