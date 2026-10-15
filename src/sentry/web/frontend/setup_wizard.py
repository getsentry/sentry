from __future__ import annotations

from collections import defaultdict
from typing import Any
from urllib.parse import parse_qsl, urlparse, urlunparse

from django.conf import settings
from django.http import Http404, HttpRequest, HttpResponse
from django.http.response import HttpResponseBase
from django.shortcuts import get_object_or_404

from sentry.api.base import allow_cors_options
from sentry.api.endpoints.setup_wizard import SETUP_WIZARD_CACHE_KEY, SETUP_WIZARD_CACHE_TIMEOUT
from sentry.cache import default_cache
from sentry.demo_mode.utils import is_demo_user
from sentry.models.organization import OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.projects.services.project.service import project_service
from sentry.utils import auth, json
from sentry.utils.http import absolute_uri
from sentry.utils.setup_wizard import get_cache_data, serialize_org_mapping
from sentry.utils.urls import add_params_to_url
from sentry.web.client_config import get_client_config
from sentry.web.frontend.base import BaseView, control_silo_view
from sentry.web.helpers import render_to_response


@control_silo_view
class SetupWizardView(BaseView):
    def handle_auth_required(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
        if request.GET.get("signup") == "1" and settings.SENTRY_SIGNUP_URL:
            uri_components = list(urlparse(absolute_uri(request.get_full_path())))

            # get the params from the url and apply it to the signup url
            params_for_signup = dict(parse_qsl(uri_components[4]))
            # remove the signup query param
            params_for_signup.pop("signup", None)
            # remove query params from next url
            uri_components[4] = ""
            # add the params to the signup url
            params = {"next": urlunparse(uri_components), **params_for_signup}
            return self.redirect(add_params_to_url(settings.SENTRY_SIGNUP_URL, params))
        if request.GET.get("partner") is not None:
            redirect_to = auth.get_login_url()
            return self.redirect(add_params_to_url(redirect_to, request.GET))
        return super().handle_auth_required(request, *args, **kwargs)

    @allow_cors_options
    def get(self, request: HttpRequest, wizard_hash) -> HttpResponseBase:
        """
        This opens a page where with an active session fill stuff into the cache
        Redirects to organization whenever cache has been deleted
        """
        if is_demo_user(request.user):
            return HttpResponse(status=403)
        elif not request.user.is_authenticated:
            return HttpResponse(status=400)

        context = {
            "hash": wizard_hash,
            "enableProjectSelection": False,
            "react_config": get_client_config(request, self.active_organization),
        }
        cache_key = f"{SETUP_WIZARD_CACHE_KEY}{wizard_hash}"

        org_slug = request.GET.get("org_slug")
        project_slug = request.GET.get("project_slug")

        wizard_data = default_cache.get(cache_key)
        if wizard_data is None:
            return self.redirect_to_org(request)

        member_org_ids = OrganizationMemberMapping.objects.filter(
            user_id=request.user.id
        ).values_list("organization_id", flat=True)
        org_mappings = OrganizationMapping.objects.filter(
            organization_id__in=member_org_ids,
            status=OrganizationStatus.ACTIVE,
        ).order_by("-date_created")

        # {'us': {'org_ids': [...], 'projects': [...], 'keys': [...]}}
        region_data_map: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))

        org_mappings_map = {}
        for mapping in org_mappings:
            region_data_map[mapping.cell_name]["org_ids"].append(mapping.organization_id)
            serialized_mapping = serialize_org_mapping(mapping)
            org_mappings_map[mapping.organization_id] = serialized_mapping

        context["organizations"] = list(org_mappings_map.values())
        context["enableProjectSelection"] = True

        # If org_slug and project_slug are provided, we will use them to select the project
        # If the project is not found or the slugs are not provided, we will show the project selection
        if org_slug is not None and project_slug is not None:
            target_org_mapping = next(
                (mapping for mapping in org_mappings if mapping.slug == org_slug), None
            )
            if target_org_mapping is not None:
                target_project = project_service.get_by_slug(
                    slug=project_slug, organization_id=target_org_mapping.organization_id
                )

                if target_project is not None:
                    cache_data = get_cache_data(
                        mapping=target_org_mapping, project=target_project, user=request.user
                    )
                    default_cache.set(cache_key, cache_data, SETUP_WIZARD_CACHE_TIMEOUT)
                    context["enableProjectSelection"] = False

        return render_to_response("sentry/setup-wizard.html", context, request)

    @allow_cors_options
    def post(self, request: HttpRequest, wizard_hash=None) -> HttpResponse:
        """
        This updates the cache content for a specific hash
        """
        if is_demo_user(request.user):
            return HttpResponse(
                status=403, content='{"error":"Forbidden"}', content_type="application/json"
            )
        elif not request.user.is_authenticated:
            return HttpResponse(
                status=400, content='{"error":"Unauthorized"}', content_type="application/json"
            )

        json_data = json.loads(request.body)
        organization_id = json_data.get("organizationId", None)
        project_id = json_data.get("projectId", None)

        if organization_id is None or project_id is None or wizard_hash is None:
            return HttpResponse(
                status=400,
                content='{"error":"Some parameters are missing"}',
                content_type="application/json",
            )

        member_org_ids = OrganizationMemberMapping.objects.filter(
            user_id=request.user.id
        ).values_list("organization_id", flat=True)
        mapping = get_object_or_404(
            OrganizationMapping,
            organization_id=organization_id,
            organization_id__in=member_org_ids,
        )

        project = project_service.get_by_id(organization_id=mapping.organization_id, id=project_id)
        if project is None:
            return HttpResponse(
                status=404,
                content='{"error":"Project not found"}',
                content_type="application/json",
            )

        try:
            cache_data = get_cache_data(mapping=mapping, project=project, user=request.user)
        except Http404:
            return HttpResponse(
                status=404,
                content='{"error":"No DSN found for this project"}',
                content_type="application/json",
            )

        key = f"{SETUP_WIZARD_CACHE_KEY}{wizard_hash}"
        default_cache.set(key, cache_data, SETUP_WIZARD_CACHE_TIMEOUT)
        return HttpResponse(status=200, content="{}", content_type="application/json")

    @allow_cors_options
    def options(self, request, *args, **kwargs):
        return super().options(request, *args, **kwargs)

    @allow_cors_options
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)
