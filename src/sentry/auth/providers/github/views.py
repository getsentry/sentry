from django import forms

from sentry.auth.view import AuthView, ConfigureView
from sentry.models import AuthIdentity

from .client import GitHubClient
from .constants import (
    ERR_NO_ORG_ACCESS,
    ERR_NO_PRIMARY_EMAIL,
    ERR_NO_SINGLE_PRIMARY_EMAIL,
    ERR_NO_SINGLE_VERIFIED_PRIMARY_EMAIL,
    ERR_NO_VERIFIED_PRIMARY_EMAIL,
    REQUIRE_VERIFIED_EMAIL,
)


def _get_name_from_email(email):
    """
    Given an email return a capitalized name. Ex. john.smith@example.com would return John Smith.
    """
    name = email.rsplit("@", 1)[0]
    name = " ".join(n_part.capitalize() for n_part in name.split("."))
    return name


class FetchUser(AuthView):
    def __init__(self, org=None, *args, **kwargs):
        self.org = org
        super().__init__(*args, **kwargs)

    def handle(self, request, helper):
        with GitHubClient(helper.fetch_state("data")["access_token"]) as client:
            if self.org is not None:
                if not client.is_org_member(self.org["id"]):
                    return helper.error(ERR_NO_ORG_ACCESS)

            user = client.get_user()

            if not user.get("email"):
                emails = client.get_user_emails()
                email = [
                    e["email"]
                    for e in emails
                    if ((not REQUIRE_VERIFIED_EMAIL) or e["verified"]) and e["primary"]
                ]
                if len(email) == 0:
                    if REQUIRE_VERIFIED_EMAIL:
                        msg = ERR_NO_VERIFIED_PRIMARY_EMAIL
                    else:
                        msg = ERR_NO_PRIMARY_EMAIL
                    return helper.error(msg)
                elif len(email) > 1:
                    if REQUIRE_VERIFIED_EMAIL:
                        msg = ERR_NO_SINGLE_VERIFIED_PRIMARY_EMAIL
                    else:
                        msg = ERR_NO_SINGLE_PRIMARY_EMAIL
                    return helper.error(msg)
                else:
                    user["email"] = email[0]

            # A user hasn't set their name in their Github profile so it isn't
            # populated in the response
            if not user.get("name"):
                user["name"] = _get_name_from_email(user["email"])

            helper.bind_state("user", user)

            return helper.next_step()


class ConfirmEmailForm(forms.Form):
    email = forms.EmailField(label="Email")


class ConfirmEmail(AuthView):
    def handle(self, request, helper):
        user = helper.fetch_state("user")

        # TODO(dcramer): this isn't ideal, but our current flow doesnt really
        # support this behavior;
        try:
            auth_identity = AuthIdentity.objects.select_related("user").get(
                auth_provider=helper.provider_model, ident=user["id"]
            )
        except AuthIdentity.DoesNotExist:
            pass
        else:
            user["email"] = auth_identity.user.email

        if user.get("email"):
            return helper.next_step()

        form = ConfirmEmailForm(request.POST or None)
        if form.is_valid():
            user["email"] = form.cleaned_data["email"]
            helper.bind_state("user", user)
            return helper.next_step()

        return self.respond("sentry_auth_github/enter-email.html", {"form": form})


class SelectOrganizationForm(forms.Form):
    org = forms.ChoiceField(label="Organization")

    def __init__(self, org_list, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.fields["org"].choices = [(o["id"], o["login"]) for o in org_list]
        self.fields["org"].widget.choices = self.fields["org"].choices


class SelectOrganization(AuthView):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def handle(self, request, helper):
        with GitHubClient(helper.fetch_state("data")["access_token"]) as client:
            org_list = client.get_org_list()

        form = SelectOrganizationForm(org_list, request.POST or None)
        if form.is_valid():
            org_id = form.cleaned_data["org"]
            org = [o for o in org_list if org_id == str(o["id"])][0]
            helper.bind_state("org", org)
            return helper.next_step()

        return self.respond(
            "sentry_auth_github/select-organization.html", {"form": form, "org_list": org_list}
        )


class GitHubConfigureView(ConfigureView):
    def dispatch(self, request, organization, auth_provider):
        return self.render("sentry_auth_github/configure.html")
