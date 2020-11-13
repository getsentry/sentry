from __future__ import absolute_import

from six.moves.urllib.parse import urlparse
from django.utils.translation import ugettext_lazy as _
from django import forms

from sentry import http
from sentry.web.helpers import render_to_response
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.identity.github_enterprise import get_user_info
from sentry.integrations import (
    IntegrationMetadata,
    IntegrationInstallation,
    FeatureDescription,
    IntegrationFeatures,
)
from sentry.shared_integrations.constants import ERR_INTERNAL, ERR_UNAUTHORIZED
from sentry.shared_integrations.exceptions import ApiError
from sentry.integrations.repositories import RepositoryMixin
from sentry.pipeline import NestedPipelineView, PipelineView
from sentry.utils.http import absolute_uri
from sentry.integrations.github.integration import GitHubIntegrationProvider, build_repository_query
from sentry.integrations.github.issues import GitHubIssueBasic
from sentry.integrations.github.utils import get_jwt

from .repository import GitHubEnterpriseRepositoryProvider
from .client import GitHubEnterpriseAppsClient

DESCRIPTION = """
Connect your Sentry organization into your on-premise GitHub Enterprise
instances. Take a step towards augmenting your sentry issues with commits from
your repositories ([using releases](https://docs.sentry.io/learn/releases/))
and linking up your GitHub issues and pull requests directly to issues in
Sentry.
"""

FEATURES = [
    FeatureDescription(
        """
        Authorize repositories to be added to your Sentry organization to augment
        sentry issues with commit data with [deployment
        tracking](https://docs.sentry.io/learn/releases/).
        """,
        IntegrationFeatures.COMMITS,
    ),
    FeatureDescription(
        """
        Create and link Sentry issue groups directly to a GitHub issue or pull
        request in any of your repositories, providing a quick way to jump from
        Sentry bug to tracked issue or PR!
        """,
        IntegrationFeatures.ISSUE_BASIC,
    ),
]


disable_dialog = {
    "actionText": "Visit GitHub Enterprise",
    "body": "Before deleting this integration, you must uninstall it from your"
    " GitHub Enterprise instance. After uninstalling, your integration"
    " will be disabled at which point you can choose to delete this"
    " integration.",
}

removal_dialog = {
    "actionText": "Delete",
    "body": "Deleting this integration will delete all associated repositories"
    " and commit data. This action cannot be undone. Are you sure you"
    " want to delete your integration?",
}

setup_alert = {
    "type": "warning",
    "icon": "icon-warning-sm",
    "text": "Your GitHub enterprise instance must be able to communicate with"
    " Sentry. Sentry makes outbound requests from a [static set of IP"
    " addresses](https://docs.sentry.io/ip-ranges/) that you may wish"
    " to allow in your firewall to support this integration.",
}

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?title=GitHub%20Integration:%20&labels=Component%3A%20Integrations",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/github_enterprise",
    aspects={
        "disable_dialog": disable_dialog,
        "removal_dialog": removal_dialog,
        "alerts": [setup_alert],
    },
)


API_ERRORS = {
    404: "If this repository exists, ensure"
    + " that your installation has permission to access this repository"
    + " (https://github.com/settings/installations).",
    401: ERR_UNAUTHORIZED,
}


class GitHubEnterpriseIntegration(IntegrationInstallation, GitHubIssueBasic, RepositoryMixin):
    repo_search = True

    def get_client(self):
        base_url = self.model.metadata["domain_name"].split("/")[0]
        return GitHubEnterpriseAppsClient(
            base_url=base_url,
            integration=self.model,
            private_key=self.model.metadata["installation"]["private_key"],
            app_id=self.model.metadata["installation"]["id"],
            verify_ssl=self.model.metadata["installation"]["verify_ssl"],
        )

    def get_repositories(self, query=None):
        if not query:
            return [
                {"name": i["name"], "identifier": i["full_name"]}
                for i in self.get_client().get_repositories()
            ]

        full_query = build_repository_query(self.model.metadata, self.model.name, query)
        response = self.get_client().search_repositories(full_query)
        return [
            {"name": i["name"], "identifier": i["full_name"]} for i in response.get("items", [])
        ]

    def search_issues(self, query):
        return self.get_client().search_issues(query)

    def reinstall(self):
        installation_id = self.model.external_id.split(":")[1]
        metadata = self.model.metadata
        metadata["installation_id"] = installation_id
        self.model.update(metadata=metadata)
        self.reinstall_repositories()

    def message_from_error(self, exc):
        if isinstance(exc, ApiError):
            message = API_ERRORS.get(exc.code)
            if message is None:
                message = exc.json.get("message", "unknown error") if exc.json else "unknown error"
            return "Error Communicating with GitHub Enterprise (HTTP %s): %s" % (exc.code, message)
        else:
            return ERR_INTERNAL


class InstallationForm(forms.Form):
    url = forms.CharField(
        label="Installation Url",
        help_text=_(
            'The "base URL" for your GitHub enterprise instance, ' "includes the host and protocol."
        ),
        widget=forms.TextInput(attrs={"placeholder": "https://github.example.com"}),
    )
    id = forms.CharField(
        label="GitHub App ID",
        help_text=_(
            "The App ID of your Sentry app. This can be " "found on your apps configuration page."
        ),
        widget=forms.TextInput(attrs={"placeholder": "1"}),
    )
    name = forms.CharField(
        label="GitHub App Name",
        help_text=_(
            "The GitHub App name of your Sentry app. "
            "This can be found on the apps configuration "
            "page."
        ),
        widget=forms.TextInput(attrs={"placeholder": "our-sentry-app"}),
    )
    verify_ssl = forms.BooleanField(
        label=_("Verify SSL"),
        help_text=_(
            "By default, we verify SSL certificates "
            "when delivering payloads to your GitHub "
            "Enterprise instance"
        ),
        widget=forms.CheckboxInput(),
        required=False,
    )
    webhook_secret = forms.CharField(
        label="GitHub App Webhook Secret",
        help_text=_(
            "We require a webhook secret to be "
            "configured. This can be generated as any "
            "random string value of your choice and "
            "should match your GitHub app "
            "configuration."
        ),
        widget=forms.TextInput(attrs={"placeholder": "XXXXXXXXXXXXXXXXXXXXXXXXXXX"}),
    )
    private_key = forms.CharField(
        label="GitHub App Private Key",
        help_text=_("The Private Key generated for your Sentry " "GitHub App."),
        widget=forms.Textarea(
            attrs={
                "rows": "60",
                "placeholder": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
            }
        ),
    )
    client_id = forms.CharField(
        label="GitHub App OAuth Client ID", widget=forms.TextInput(attrs={"placeholder": "1"})
    )
    client_secret = forms.CharField(
        label="GitHub App OAuth Client Secret",
        widget=forms.TextInput(attrs={"placeholder": "XXXXXXXXXXXXXXXXXXXXXXXXXXX"}),
    )

    def __init__(self, *args, **kwargs):
        super(InstallationForm, self).__init__(*args, **kwargs)
        self.fields["verify_ssl"].initial = True


class InstallationConfigView(PipelineView):
    def dispatch(self, request, pipeline):
        if request.method == "POST":
            form = InstallationForm(request.POST)
            if form.is_valid():
                form_data = form.cleaned_data
                form_data["url"] = urlparse(form_data["url"]).netloc

                pipeline.bind_state("installation_data", form_data)

                pipeline.bind_state(
                    "oauth_config_information",
                    {
                        "access_token_url": u"https://{}/login/oauth/access_token".format(
                            form_data.get("url")
                        ),
                        "authorize_url": u"https://{}/login/oauth/authorize".format(
                            form_data.get("url")
                        ),
                        "client_id": form_data.get("client_id"),
                        "client_secret": form_data.get("client_secret"),
                        "verify_ssl": form_data.get("verify_ssl"),
                    },
                )

                return pipeline.next_step()
        else:
            form = InstallationForm()

        return render_to_response(
            template="sentry/integrations/github-enterprise-config.html",
            context={"form": form},
            request=request,
        )


class GitHubEnterpriseIntegrationProvider(GitHubIntegrationProvider):
    key = "github_enterprise"
    name = "GitHub Enterprise"
    metadata = metadata
    integration_cls = GitHubEnterpriseIntegration

    def _make_identity_pipeline_view(self):
        """
        Make the nested identity provider view. It is important that this view is
        not constructed until we reach this step and the
        ``oauth_config_information`` is available in the pipeline state. This
        method should be late bound into the pipeline vies.
        """
        identity_pipeline_config = dict(
            oauth_scopes=(),
            redirect_url=absolute_uri("/extensions/github-enterprise/setup/"),
            **self.pipeline.fetch_state("oauth_config_information")
        )

        return NestedPipelineView(
            bind_key="identity",
            provider_key="github_enterprise",
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

    def get_pipeline_views(self):
        return [
            InstallationConfigView(),
            GitHubEnterpriseInstallationRedirect(),
            # The identity provider pipeline should be constructed at execution
            # time, this allows for the oauth configuration parameters to be made
            # available from the installation config view.
            lambda: self._make_identity_pipeline_view(),
        ]

    def post_install(self, integration, organization, extra=None):
        pass

    def get_installation_info(self, installation_data, access_token, installation_id):
        session = http.build_session()
        resp = session.get(
            u"https://{}/api/v3/app/installations/{}".format(
                installation_data["url"], installation_id
            ),
            headers={
                "Authorization": b"Bearer %s"
                % get_jwt(
                    github_id=installation_data["id"],
                    github_private_key=installation_data["private_key"],
                ),
                "Accept": "application/vnd.github.machine-man-preview+json",
            },
            verify=installation_data["verify_ssl"],
        )
        resp.raise_for_status()
        installation_resp = resp.json()

        resp = session.get(
            u"https://{}/api/v3/user/installations".format(installation_data["url"]),
            params={"access_token": access_token},
            headers={"Accept": "application/vnd.github.machine-man-preview+json"},
            verify=installation_data["verify_ssl"],
        )
        resp.raise_for_status()
        user_installations_resp = resp.json()

        # verify that user actually has access to the installation
        for installation in user_installations_resp["installations"]:
            if installation["id"] == installation_resp["id"]:
                return installation_resp

        return None

    def build_integration(self, state):
        identity = state["identity"]["data"]
        installation_data = state["installation_data"]
        user = get_user_info(installation_data["url"], identity["access_token"])
        installation = self.get_installation_info(
            installation_data, identity["access_token"], state["installation_id"]
        )

        domain = urlparse(installation["account"]["html_url"]).netloc
        integration = {
            "name": installation["account"]["login"],
            # installation id is not enough to be unique for self-hosted GH
            "external_id": u"{}:{}".format(domain, installation["id"]),
            # GitHub identity is associated directly to the application, *not*
            # to the installation itself.
            # app id is not enough to be unique for self-hosted GH
            "idp_external_id": u"{}:{}".format(domain, installation["app_id"]),
            "metadata": {
                # The access token will be populated upon API usage
                "access_token": None,
                "expires_at": None,
                "icon": installation["account"]["avatar_url"],
                "domain_name": installation["account"]["html_url"].replace("https://", ""),
                "account_type": installation["account"]["type"],
                "installation_id": installation["id"],
                "installation": installation_data,
            },
            "user_identity": {
                "type": "github_enterprise",
                "external_id": user["id"],
                "scopes": [],  # GitHub apps do not have user scopes
                "data": {"access_token": identity["access_token"]},
            },
            "idp_config": state["oauth_config_information"],
        }

        if state.get("reinstall_id"):
            integration["reinstall_id"] = state["reinstall_id"]

        return integration

    def setup(self):
        from sentry.plugins.base import bindings

        bindings.add(
            "integration-repository.provider",
            GitHubEnterpriseRepositoryProvider,
            id="integrations:github_enterprise",
        )


class GitHubEnterpriseInstallationRedirect(PipelineView):
    def get_app_url(self, installation_data):
        url = installation_data.get("url")
        name = installation_data.get("name")
        return u"https://{}/github-apps/{}".format(url, name)

    def dispatch(self, request, pipeline):
        installation_data = pipeline.fetch_state(key="installation_data")
        if "reinstall_id" in request.GET:
            pipeline.bind_state("reinstall_id", request.GET["reinstall_id"])

        if "installation_id" in request.GET:
            pipeline.bind_state("installation_id", request.GET["installation_id"])
            return pipeline.next_step()

        return self.redirect(self.get_app_url(installation_data))
