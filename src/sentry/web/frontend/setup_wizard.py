from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any
from urllib.parse import parse_qsl, urlparse, urlunparse

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.http import Http404, HttpRequest, HttpResponse, HttpResponseBadRequest
from django.http.response import HttpResponseBase
from django.shortcuts import get_object_or_404

from sentry.api.base import allow_cors_options
from sentry.api.endpoints.setup_wizard import SETUP_WIZARD_CACHE_KEY, SETUP_WIZARD_CACHE_TIMEOUT
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project import STATUS_LABELS
from sentry.api.utils import generate_region_url
from sentry.cache import default_cache
from sentry.models.apitoken import ApiToken
from sentry.models.organization import OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.projects.services.project.model import RpcProject
from sentry.projects.services.project.service import project_service
from sentry.projects.services.project_key.model import ProjectKeyRole, RpcProjectKey
from sentry.projects.services.project_key.service import project_key_service
from sentry.types.token import AuthTokenType
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils import json
from sentry.utils.http import absolute_uri
from sentry.utils.security.orgauthtoken_token import (
    SystemUrlPrefixMissingException,
    generate_token,
    hash_token,
)
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
        return super().handle_auth_required(request, *args, **kwargs)

    @allow_cors_options
    def get(self, request: HttpRequest, wizard_hash) -> HttpResponseBase:
        """
        This opens a page where with an active session fill stuff into the cache
        Redirects to organization whenever cache has been deleted
        """
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
            region_data_map[mapping.region_name]["org_ids"].append(mapping.organization_id)
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
        json_data = json.loads(request.body)
        organization_id = json_data.get("organizationId", None)
        project_id = json_data.get("projectId", None)

        if organization_id is None or project_id is None or wizard_hash is None:
            return HttpResponseBadRequest()

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
            raise Http404()

        cache_data = get_cache_data(mapping=mapping, project=project, user=request.user)

        key = f"{SETUP_WIZARD_CACHE_KEY}{wizard_hash}"
        default_cache.set(key, cache_data, SETUP_WIZARD_CACHE_TIMEOUT)
        return HttpResponse(status=200)

    @allow_cors_options
    def options(self, request, *args, **kwargs):
        return super().options(request, *args, **kwargs)

    @allow_cors_options
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)


def serialize_org_mapping(mapping: OrganizationMapping):
    status = OrganizationStatus(mapping.status)
    return {
        "id": mapping.organization_id,
        "name": mapping.name,
        "slug": mapping.slug,
        "region": mapping.region_name,
        "status": {"id": status.name.lower(), "name": status.label},
    }


def serialize_project_key(project_key: RpcProjectKey):
    return {
        "dsn": {"public": project_key.dsn_public},
        "isActive": project_key.is_active,
    }


def serialize_project(project: RpcProject, organization: dict, keys: list[dict]):
    return {
        "slug": project.slug,
        "id": project.id,
        "name": project.name,
        "platform": project.platform,
        "status": STATUS_LABELS.get(project.status, "unknown"),
        "organization": organization,
        "keys": keys,
    }


def get_cache_data(
    mapping: OrganizationMapping, project: RpcProject, user: User | AnonymousUser | RpcUser
):
    project_key = project_key_service.get_project_key(
        organization_id=mapping.organization_id,
        project_id=project.id,
        role=ProjectKeyRole.store,
    )
    if project_key is None:
        raise Http404()

    enriched_project = serialize_project(
        project=project,
        # The wizard only reads the a few fields so serializing the mapping should work fine
        organization=serialize_org_mapping(mapping),
        keys=[serialize_project_key(project_key)],
    )

    serialized_token = get_org_token(mapping, user)

    return {"apiKeys": serialized_token, "projects": [enriched_project]}


def get_token(mappings: list[OrganizationMapping], user: RpcUser):
    can_use_org_tokens = len(mappings) == 1

    # If only one org, try to generate an org auth token
    if can_use_org_tokens:
        mapping = mappings[0]
        token = get_org_token(mapping=mapping, user=user)

        if token is not None:
            return token

    # Otherwise, generate a user token
    token = ApiToken.objects.create(
        user_id=user.id,
        scope_list=["project:releases"],
        token_type=AuthTokenType.USER,
        expires_at=None,
    )
    return serialize(token)


def get_org_token(mapping: OrganizationMapping, user: User | RpcUser | AnonymousUser):
    try:
        token_str = generate_token(
            mapping.slug, generate_region_url(region_name=mapping.region_name)
        )
    except SystemUrlPrefixMissingException:
        return None

    token_hashed = hash_token(token_str)
    token = OrgAuthToken.objects.create(
        name=f"Generated by Sentry Wizard on {date.today()}",
        organization_id=mapping.organization_id,
        scope_list=["org:ci"],
        created_by_id=user.id,
        token_last_characters=token_str[-4:],
        token_hashed=token_hashed,
    )
    return serialize(token, user, token=token_str)
