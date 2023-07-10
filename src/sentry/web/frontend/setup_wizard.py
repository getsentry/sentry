from __future__ import annotations

from typing import Any
from urllib.parse import parse_qsl, urlparse, urlunparse

from django.conf import settings
from django.db.models import F
from django.http import HttpRequest, HttpResponse

from sentry import roles
from sentry.api.endpoints.setup_wizard import SETUP_WIZARD_CACHE_KEY, SETUP_WIZARD_CACHE_TIMEOUT
from sentry.api.serializers import serialize
from sentry.cache import default_cache
from sentry.constants import ObjectStatus
from sentry.models import (
    ApiToken,
    Organization,
    OrganizationStatus,
    Project,
    ProjectKey,
    ProjectKeyStatus,
)
from sentry.utils.http import absolute_uri
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
        token = None
        tokens = [
            x
            for x in ApiToken.objects.filter(user=request.user).all()
            if "project:releases" in x.get_scopes()
        ]
        if not tokens:
            token = ApiToken.objects.create(
                user=request.user,
                scope_list=["project:releases"],
                refresh_token=None,
                expires_at=None,
            )
        else:
            token = tokens[0]

        result = {"apiKeys": serialize(token), "projects": filled_projects}

        key = f"{SETUP_WIZARD_CACHE_KEY}{wizard_hash}"
        default_cache.set(key, result, SETUP_WIZARD_CACHE_TIMEOUT)

        context["organizations"] = serialize(list(orgs))
        return render_to_response("sentry/setup-wizard.html", context, request)
