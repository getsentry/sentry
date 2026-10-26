from __future__ import annotations

import logging
from typing import Any

from django import forms
from django.http import HttpRequest
from django.http.response import HttpResponseBase

from sentry.auth.helper import AuthHelper
from sentry.auth.services.auth.model import RpcAuthProvider
from sentry.auth.view import AuthView
from sentry.identity.github.provider import get_verified_primary_email
from sentry.models.authidentity import AuthIdentity
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.base.response import DeferredResponse
from sentry.utils.forms import set_field_choices

from .client import GitHubApiError, GitHubClient
from .constants import (
    ERR_NO_ORG_ACCESS,
    ERR_NO_PRIMARY_EMAIL,
    ERR_NO_SINGLE_PRIMARY_EMAIL,
    ERR_NO_VERIFIED_PRIMARY_EMAIL,
    REQUIRE_VERIFIED_EMAIL,
)

logger = logging.getLogger(__name__)


def _get_name_from_email(email: str) -> str:
    """
    Given an email return a capitalized name. Ex. john.smith@example.com would return John Smith.
    """
    name = email.rsplit("@", 1)[0]
    name = " ".join(n_part.capitalize() for n_part in name.split("."))
    return name


class FetchUser(AuthView):
    def __init__(
        self, org: RpcOrganization | dict[str, Any] | None = None, *args: Any, **kwargs: Any
    ) -> None:
        self.org = org
        super().__init__(*args, **kwargs)

    def handle(self, request: HttpRequest, pipeline: AuthHelper) -> HttpResponseBase:
        data: dict[str, Any] | None = pipeline.fetch_state("data")
        assert data is not None
        with GitHubClient(data["access_token"]) as client:
            if self.org is not None:
                # if we have a configured org (self.org) for our oauth provider
                org_id = self.org.id if isinstance(self.org, RpcOrganization) else self.org["id"]
                if not client.is_org_member(org_id):
                    # `is_org_member` fetches provider orgs for the auth'd provider user.
                    # if our configured org is not in the users list of orgs, then that user
                    # does not have access to the provisioned org and we will prevent access
                    return pipeline.error(ERR_NO_ORG_ACCESS)

            user = client.get_user()
            assert isinstance(user, dict)

            is_returning_active_user = AuthIdentity.objects.filter(
                auth_provider=pipeline.provider_model, ident=user["id"], user__is_active=True
            ).exists()

            emails: list[dict[str, Any]] = []
            if not is_returning_active_user or not user.get("email"):
                # only do the 2nd api call to get_user_emails if the user is new
                # or if they don't have a public default email
                try:
                    emails = client.get_user_emails()
                except (GitHubApiError, ValueError):
                    # Best-effort, let the logic below handle missing emails
                    logger.warning("auth.github.user_emails_fetch_failed", exc_info=True)

            verified_email = get_verified_primary_email(emails)
            if verified_email:
                user["email"] = verified_email
                user["email_verified"] = True

            if not user.get("email"):
                # No public email and no verified primary. When verified emails are
                # required there's nothing left to accept; otherwise fall back to
                # the account's (possibly unverified) primary.
                #
                # NOTE: unclear whether REQUIRE_VERIFIED_EMAIL is meant to gate
                # returning users' logins at all, vs. only new-account creation.
                # Leaving this unchanged until we decide.
                if REQUIRE_VERIFIED_EMAIL:
                    return pipeline.error(ERR_NO_VERIFIED_PRIMARY_EMAIL)
                primary = [
                    e["email"]
                    for e in emails
                    if isinstance(e, dict) and e.get("email") and e.get("primary")
                ]
                if len(primary) == 0:
                    return pipeline.error(ERR_NO_PRIMARY_EMAIL)
                elif len(primary) > 1:
                    return pipeline.error(ERR_NO_SINGLE_PRIMARY_EMAIL)
                user["email"] = primary[0]

            # A user hasn't set their name in their Github profile so it isn't
            # populated in the response
            if not user.get("name"):
                user["name"] = _get_name_from_email(user["email"])

            pipeline.bind_state("user", user)

            return pipeline.next_step()


class SelectOrganizationForm(forms.Form):
    org = forms.ChoiceField(label="Organization")

    def __init__(self, org_list: list[dict[str, Any]], *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)

        set_field_choices(self.fields["org"], [(o["id"], o["login"]) for o in org_list])


class SelectOrganization(AuthView):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)

    def handle(self, request: HttpRequest, pipeline: AuthHelper) -> HttpResponseBase:
        data: dict[str, Any] | None = pipeline.fetch_state("data")
        assert data is not None
        with GitHubClient(data["access_token"]) as client:
            org_list = client.get_org_list()

        form = SelectOrganizationForm(org_list, request.POST or None)
        if form.is_valid():
            org_id = form.cleaned_data["org"]
            org = [o for o in org_list if org_id == str(o["id"])][0]
            pipeline.bind_state("org", org)
            return pipeline.next_step()

        return self.respond(
            "sentry_auth_github/select-organization.html", {"form": form, "org_list": org_list}
        )


def github_configure_view(
    request: HttpRequest, organization: RpcOrganization, auth_provider: RpcAuthProvider
) -> DeferredResponse:
    return DeferredResponse("sentry_auth_github/configure.html")
