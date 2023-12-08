from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any, List
from urllib.parse import parse_qsl, urlparse, urlunparse

from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.http.response import HttpResponseBase

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
from sentry.models.user import User
from sentry.services.hybrid_cloud.project.service import project_service
from sentry.services.hybrid_cloud.project_key.model import ProjectKeyRole
from sentry.services.hybrid_cloud.project_key.service import project_key_service
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.utils.http import absolute_uri
from sentry.utils.security.orgauthtoken_token import (
    SystemUrlPrefixMissingException,
    generate_token,
    hash_token,
)
from sentry.utils.urls import add_params_to_url
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

    def get(self, request: HttpRequest, wizard_hash) -> HttpResponseBase:
        """
        This opens a page where with an active session fill stuff into the cache
        Redirects to organization whenever cache has been deleted
        """
        context = {"hash": wizard_hash}
        key = f"{SETUP_WIZARD_CACHE_KEY}{wizard_hash}"

        wizard_data = default_cache.get(key)
        if wizard_data is None:
            return self.redirect_to_org(request)

        member_org_ids = OrganizationMemberMapping.objects.filter(
            user_id=request.user.id
        ).values_list("organization_id", flat=True)
        org_mappings = OrganizationMapping.objects.filter(
            organization_id__in=member_org_ids,
            status=OrganizationStatus.ACTIVE,
        ).order_by("-date_created")

        # TODO: Make wizard compatible with hybrid cloud. For now, we combine all region data for these
        # responses, but project names/slugs aren't unique across regions which could confuse some users.
        # Wizard should display region beside project/orgs or have a step to ask which region.

        # {'us': {'org_ids': [...], 'projects': [...], 'keys': [...]}}
        region_data_map = defaultdict(lambda: defaultdict(list))

        org_mappings_map = {}
        for mapping in org_mappings:
            region_data_map[mapping.region_name]["org_ids"].append(mapping.organization_id)
            status = OrganizationStatus(mapping.status)
            serialized_mapping = {
                "id": mapping.organization_id,
                "name": mapping.name,
                "slug": mapping.slug,
                "region": mapping.region_name,
                "status": {"id": status.name.lower(), "name": status.label},
            }
            org_mappings_map[mapping.organization_id] = serialized_mapping

        for region_name, region_data in region_data_map.items():
            org_ids = region_data["org_ids"]
            projects = project_service.get_many_by_organizations(
                region_name=region_name, organization_ids=org_ids
            )
            region_data["projects"] = projects

        keys_map = defaultdict(list)
        for region_name, region_data in region_data_map.items():
            project_ids = [rpc_project.id for rpc_project in region_data["projects"]]
            keys = project_key_service.get_project_keys_by_region(
                region_name=region_name,
                project_ids=project_ids,
                role=ProjectKeyRole.store,
            )
            region_data["keys"] = keys
            for key in region_data["keys"]:
                serialized_key = {
                    "dsn": {"public": key.dsn_public},
                    "isActive": key.is_active,
                }
                keys_map[key.project_id].append(serialized_key)

        filled_projects = []
        for region_name, region_data in region_data_map.items():
            for project in region_data["projects"]:
                enriched_project = {
                    "slug": project.slug,
                    "id": project.id,
                    "status": STATUS_LABELS.get(project.status, "unknown"),
                }
                # The wizard only reads the a few fields so serializing the mapping should work fine
                enriched_project["organization"] = org_mappings_map[project.organization_id]
                enriched_project["keys"] = keys_map[project.id]
                filled_projects.append(enriched_project)

        # Fetching or creating a token
        serialized_token = get_token(org_mappings, request.user)

        result = {"apiKeys": serialized_token, "projects": filled_projects}

        key = f"{SETUP_WIZARD_CACHE_KEY}{wizard_hash}"
        default_cache.set(key, result, SETUP_WIZARD_CACHE_TIMEOUT)

        context["organizations"] = list(org_mappings_map.values())
        return render_to_response("sentry/setup-wizard.html", context, request)


def get_token(mappings: List[OrganizationMapping], user: RpcUser):
    can_use_org_tokens = len(mappings) == 1

    # If only one org, try to generate an org auth token
    if can_use_org_tokens:
        mapping = mappings[0]
        token = get_org_token(mapping=mapping, user=user)

        if token is not None:
            return token

    # Otherwise, generate a user token
    tokens = ApiToken.objects.filter(user_id=user.id)
    token = next((token for token in tokens if "project:releases" in token.get_scopes()), None)
    if token is None:
        token = ApiToken.objects.create(
            user_id=user.id,
            scope_list=["project:releases"],
            refresh_token=None,
            expires_at=None,
        )
    return serialize(token)


def get_org_token(mapping: OrganizationMapping, user: User | RpcUser):
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
