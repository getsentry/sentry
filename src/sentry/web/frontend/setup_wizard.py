from __future__ import annotations

from datetime import date
from typing import Any
from urllib.parse import parse_qsl, urlparse, urlunparse

from django.conf import settings
from django.db.models import F
from django.http import HttpRequest, HttpResponse

from sentry import roles
from sentry.api.endpoints.setup_wizard import SETUP_WIZARD_CACHE_KEY, SETUP_WIZARD_CACHE_TIMEOUT
from sentry.api.serializers import serialize
from sentry.api.utils import generate_region_url
from sentry.cache import default_cache
from sentry.constants import ObjectStatus
from sentry.models.apitoken import ApiToken
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey, ProjectKeyStatus
from sentry.models.user import User
from sentry.utils.http import absolute_uri
from sentry.utils.security.orgauthtoken_token import (
    SystemUrlPrefixMissingException,
    generate_token,
    hash_token,
)
from sentry.utils.urls import add_params_to_url
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response


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

    def get(self, request: HttpRequest, wizard_hash) -> HttpResponse:
        """
        This opens a page where with an active session fill stuff into the cache
        Redirects to organization whenever cache has been deleted
        """
        context = {"hash": wizard_hash}
        key = f"{SETUP_WIZARD_CACHE_KEY}{wizard_hash}"

        wizard_data = default_cache.get(key)
        if wizard_data is None:
            return self.redirect_to_org(request)

        orgs = Organization.objects.filter(
            member_set__role__in=[x.id for x in roles.with_scope("org:read")],
            member_set__user_id=request.user.id,
            status=OrganizationStatus.ACTIVE,
        ).order_by("-date_added")

        projects = Project.objects.filter(organization__in=orgs, status=ObjectStatus.ACTIVE)

        keys = ProjectKey.objects.filter(
            project__in=projects,
            roles=F("roles").bitor(ProjectKey.roles.store),
            status=ProjectKeyStatus.ACTIVE,
        )

        orgs_map = {}
        for org in orgs:
            orgs_map[org.id] = org

        keys_map = {}
        for key in keys:
            if key.project_id not in keys_map:
                keys_map[key.project_id] = [key]
            else:
                keys_map[key.project_id].append(key)

        filled_projects = []

        for project in projects:
            enriched_project = serialize(project)
            enriched_project["organization"] = serialize(orgs_map[project.organization_id])
            enriched_project["keys"] = serialize(keys_map.get(project.id, []))
            filled_projects.append(enriched_project)

        # Fetching or creating a token
        serialized_token = get_token(orgs, request.user)

        result = {"apiKeys": serialized_token, "projects": filled_projects}

        key = f"{SETUP_WIZARD_CACHE_KEY}{wizard_hash}"
        default_cache.set(key, result, SETUP_WIZARD_CACHE_TIMEOUT)

        context["organizations"] = serialize(list(orgs))
        return render_to_response("sentry/setup-wizard.html", context, request)


def get_token(orgs: list[Organization], user: User):
    can_use_org_tokens = len(orgs) == 1

    # If only one org, try to generate an org auth token
    if can_use_org_tokens:
        org = orgs[0]
        token = get_org_token(org, user)

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


def get_org_token(org: Organization, user: User):
    try:
        token_str = generate_token(org.slug, generate_region_url())
    except SystemUrlPrefixMissingException:
        return None

    token_hashed = hash_token(token_str)
    token = OrgAuthToken.objects.create(
        name=f"Generated by Sentry Wizard on {date.today()}",
        organization_id=org.id,
        scope_list=["org:ci"],
        created_by_id=user.id,
        token_last_characters=token_str[-4:],
        token_hashed=token_hashed,
    )
    return serialize(token, user, token=token_str)
