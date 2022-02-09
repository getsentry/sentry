import logging
from urllib.parse import urlparse

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from django import forms
from django.core.validators import URLValidator
from django.utils.translation import ugettext_lazy as _
from django.views.decorators.csrf import csrf_exempt
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.integrations import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.mixins import RepositoryMixin
from sentry.models import Identity, Repository
from sentry.pipeline import PipelineView
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.tasks.integrations import migrate_repo
from sentry.utils.compat import filter
from sentry.web.helpers import render_to_response

from .client import BitbucketServer, BitbucketServerSetupClient
from .repository import BitbucketServerRepositoryProvider

logger = logging.getLogger("sentry.integrations.bitbucket_server")

DESCRIPTION = """
Connect your Sentry organization to Bitbucket Server, enabling the following features:
"""

FEATURES = [
    FeatureDescription(
        """
        Track commits and releases (learn more
        [here](https://docs.sentry.io/learn/releases/))
        """,
        IntegrationFeatures.COMMITS,
    ),
    FeatureDescription(
        """
        Resolve Sentry issues via Bitbucket Server commits by
        including `Fixes PROJ-ID` in the message
        """,
        IntegrationFeatures.COMMITS,
    ),
]

setup_alert = {
    "type": "warning",
    "icon": "icon-warning-sm",
    "text": "Your Bitbucket Server instance must be able to communicate with Sentry."
    " Sentry makes outbound requests from a [static set of IP"
    " addresses](https://docs.sentry.io/ip-ranges/) that you may wish"
    " to explicitly allow in your firewall to support this integration.",
}

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Bitbucket%20Server%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/bitbucket_server",
    aspects={},
)


class InstallationForm(forms.Form):
    url = forms.CharField(
        label=_("Bitbucket URL"),
        help_text=_(
            "The base URL for your Bitbucket Server instance, including the host and protocol."
        ),
        widget=forms.TextInput(attrs={"placeholder": "https://bitbucket.example.com"}),
        validators=[URLValidator()],
    )
    verify_ssl = forms.BooleanField(
        label=_("Verify SSL"),
        help_text=_(
            "By default, we verify SSL certificates "
            "when making requests to your Bitbucket instance."
        ),
        widget=forms.CheckboxInput(),
        required=False,
        initial=True,
    )
    consumer_key = forms.CharField(
        label=_("Bitbucket Consumer Key"),
        widget=forms.TextInput(attrs={"placeholder": "sentry-consumer-key"}),
    )
    private_key = forms.CharField(
        label=_("Bitbucket Consumer Private Key"),
        widget=forms.Textarea(
            attrs={
                "placeholder": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
            }
        ),
    )

    def clean_url(self):
        """Strip off trailing / as they cause invalid URLs downstream"""
        return self.cleaned_data["url"].rstrip("/")

    def clean_private_key(self):
        data = self.cleaned_data["private_key"]

        try:
            load_pem_private_key(data.encode("utf-8"), None, default_backend())
        except Exception:
            raise forms.ValidationError(
                "Private key must be a valid SSH private key encoded in a PEM format."
            )
        return data

    def clean_consumer_key(self):
        data = self.cleaned_data["consumer_key"]
        if len(data) > 200:
            raise forms.ValidationError("Consumer key is limited to 200 characters.")
        return data


class InstallationConfigView(PipelineView):
    """
    Collect the OAuth client credentials from the user.
    """

    def dispatch(self, request: Request, pipeline) -> Response:
        if request.method == "POST":
            form = InstallationForm(request.POST)
            if form.is_valid():
                form_data = form.cleaned_data

                pipeline.bind_state("installation_data", form_data)
                return pipeline.next_step()
        else:
            form = InstallationForm()

        return render_to_response(
            template="sentry/integrations/bitbucket-server-config.html",
            context={"form": form},
            request=request,
        )


class OAuthLoginView(PipelineView):
    """
    Start the OAuth dance by creating a request token
    and redirecting the user to approve it.
    """

    @csrf_exempt
    def dispatch(self, request: Request, pipeline) -> Response:
        if "oauth_token" in request.GET:
            return pipeline.next_step()

        config = pipeline.fetch_state("installation_data")
        client = BitbucketServerSetupClient(
            config.get("url"),
            config.get("consumer_key"),
            config.get("private_key"),
            config.get("verify_ssl"),
        )

        try:
            request_token = client.get_request_token()
            pipeline.bind_state("request_token", request_token)
            authorize_url = client.get_authorize_url(request_token)

            return self.redirect(authorize_url)
        except ApiError as error:
            logger.info(
                "identity.bitbucket-server.request-token",
                extra={"url": config.get("url"), "error": error},
            )
            return pipeline.error(f"Could not fetch a request token from Bitbucket. {error}")


class OAuthCallbackView(PipelineView):
    """
    Complete the OAuth dance by exchanging our request token
    into an access token.
    """

    @csrf_exempt
    def dispatch(self, request: Request, pipeline) -> Response:
        config = pipeline.fetch_state("installation_data")
        client = BitbucketServerSetupClient(
            config.get("url"),
            config.get("consumer_key"),
            config.get("private_key"),
            config.get("verify_ssl"),
        )

        try:
            access_token = client.get_access_token(
                pipeline.fetch_state("request_token"), request.GET["oauth_token"]
            )

            pipeline.bind_state("access_token", access_token)

            return pipeline.next_step()
        except ApiError as error:
            logger.info("identity.bitbucket-server.access-token", extra={"error": error})
            return pipeline.error(f"Could not fetch an access token from Bitbucket. {str(error)}")


class BitbucketServerIntegration(IntegrationInstallation, RepositoryMixin):
    """
    IntegrationInstallation implementation for Bitbucket Server
    """

    repo_search = True

    default_identity = None

    def get_client(self):
        if self.default_identity is None:
            try:
                self.default_identity = self.get_default_identity()
            except Identity.DoesNotExist:
                raise IntegrationError("Identity not found.")

        return BitbucketServer(
            self.model.metadata["base_url"],
            self.default_identity.data,
            self.model.metadata["verify_ssl"],
        )

    @property
    def username(self):
        return self.model.name

    def error_message_from_json(self, data):
        return data.get("error", {}).get("message", "unknown error")

    def get_repositories(self, query=None):
        if not query:
            resp = self.get_client().get_repos()

            return [
                {
                    "identifier": repo["project"]["key"] + "/" + repo["slug"],
                    "project": repo["project"]["key"],
                    "repo": repo["slug"],
                    "name": repo["project"]["name"] + "/" + repo["name"],
                }
                for repo in resp.get("values", [])
            ]

        full_query = (query).encode("utf-8")
        resp = self.get_client().search_repositories(full_query)

        return [
            {
                "identifier": repo["project"]["key"] + "/" + repo["slug"],
                "project": repo["project"]["key"],
                "repo": repo["slug"],
                "name": repo["project"]["name"] + "/" + repo["name"],
            }
            for repo in resp.get("values", [])
        ]

    def has_repo_access(self, repo):
        """
        We can assume user always has repo access, since the Bitbucket API is limiting the results based on the REPO_ADMIN permission
        """

        return True

    def get_unmigratable_repositories(self):
        repos = Repository.objects.filter(
            organization_id=self.organization_id, provider="bitbucket_server"
        )

        accessible_repos = [r["identifier"] for r in self.get_repositories()]

        return filter(lambda repo: repo.name not in accessible_repos, repos)

    def reinstall(self):
        self.reinstall_repositories()


class BitbucketServerIntegrationProvider(IntegrationProvider):
    key = "bitbucket_server"
    name = "Bitbucket Server"
    metadata = metadata
    integration_cls = BitbucketServerIntegration
    needs_default_identity = True
    can_add = True
    features = frozenset([IntegrationFeatures.COMMITS])
    setup_dialog_config = {"width": 1030, "height": 1000}

    def get_pipeline_views(self):
        return [InstallationConfigView(), OAuthLoginView(), OAuthCallbackView()]

    def post_install(self, integration, organization, extra=None):
        repo_ids = Repository.objects.filter(
            organization_id=organization.id,
            provider__in=["bitbucket_server", "integrations:bitbucket_server"],
            integration_id__isnull=True,
        ).values_list("id", flat=True)

        for repo_id in repo_ids:
            migrate_repo.apply_async(
                kwargs={
                    "repo_id": repo_id,
                    "integration_id": integration.id,
                    "organization_id": organization.id,
                }
            )

    def build_integration(self, state):
        install = state["installation_data"]
        access_token = state["access_token"]

        hostname = urlparse(install["url"]).netloc
        external_id = "{}:{}".format(hostname, install["consumer_key"])[:64]

        credentials = {
            "consumer_key": install["consumer_key"],
            "private_key": install["private_key"],
            "access_token": access_token["oauth_token"],
            "access_token_secret": access_token["oauth_token_secret"],
        }

        return {
            "name": install["consumer_key"],
            "provider": self.key,
            "external_id": external_id,
            "metadata": {
                "base_url": install["url"],
                "domain_name": hostname,
                "verify_ssl": install["verify_ssl"],
            },
            "user_identity": {
                "type": self.key,
                "external_id": external_id,
                "data": credentials,
                "scopes": [],
            },
        }

    def setup(self):
        from sentry.plugins.base import bindings

        bindings.add(
            "integration-repository.provider",
            BitbucketServerRepositoryProvider,
            id=f"integrations:{self.key}",
        )
