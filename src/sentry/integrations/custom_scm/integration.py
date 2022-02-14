from __future__ import annotations

from uuid import uuid4

from django import forms
from django.utils.translation import ugettext_lazy as _
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.constants import ObjectStatus
from sentry.integrations import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.mixins import RepositoryMixin
from sentry.models.repository import Repository
from sentry.pipeline import PipelineView
from sentry.web.helpers import render_to_response

from .repository import CustomSCMRepositoryProvider

DESCRIPTION = """
Custom Source Control Management (SCM)
"""

FEATURES = [
    FeatureDescription(
        """
        Send your own commits
        """,
        IntegrationFeatures.COMMITS,
    ),
    FeatureDescription(
        """
        Stack trace linky dink
        """,
        IntegrationFeatures.STACKTRACE_LINK,
    ),
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/custom_scm",
    aspects={},
)


class CustomSCMIntegration(IntegrationInstallation, RepositoryMixin):
    def get_client(self):
        pass

    def get_stacktrace_link(
        self, repo: Repository, filepath: str, default: str, version: str
    ) -> str | None:
        """
        We don't have access to verify that the file does exists
        (using `check_file`) so instead we just return the
        formatted source url using the default branch provided.
        """
        return self.format_source_url(repo, filepath, default)

    def format_source_url(self, repo: Repository, filepath: str, branch: str) -> str:
        # This format works for GitHub/GitLab, not sure if it would
        # need to change for a different provider
        return f"{repo.url}/blob/{branch}/{filepath}"

    def get_repositories(self, query=None):
        """
        Used to get any repositories that are not already tied
        to an integration.
        """
        repos = Repository.objects.filter(
            organization_id=self.organization_id,
            provider__isnull=True,
            integration_id__isnull=True,
            status=ObjectStatus.VISIBLE,
        )
        return [{"name": repo.name, "identifier": str(repo.id)} for repo in repos]


class InstallationForm(forms.Form):
    name = forms.CharField(
        label=_("Name"),
        help_text=_(
            "The name for your integration."
            "<br>"
            "If you are using GitHub, use the organization name."
        ),
    )
    url = forms.CharField(
        label=_("URL"),
        help_text=_(
            "The base URL for your instance, including the host and protocol. "
            "<br>"
            "If using github.com, enter https://github.com/"
        ),
        widget=forms.TextInput(attrs={"placeholder": "https://github.com/"}),
    )


class InstallationConfigView(PipelineView):
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
            template="sentry/integrations/custom-scm-config.html",
            context={"form": form},
            request=request,
        )


class CustomSCMIntegrationProvider(IntegrationProvider):
    key = "custom_scm"
    name = "Custom Source Control Management (SCM)"
    requires_feature_flag = True
    metadata = metadata
    integration_cls = CustomSCMIntegration
    features = frozenset(
        [
            IntegrationFeatures.COMMITS,
            IntegrationFeatures.STACKTRACE_LINK,
            IntegrationFeatures.CODEOWNERS,
        ]
    )

    def get_pipeline_views(self):
        return [InstallationConfigView()]

    def build_integration(self, state):
        name = state["installation_data"]["name"]
        url = state["installation_data"]["url"]
        # normally the external_id would be something unique
        # across organizations, but for now there can just be
        # separate integrations for separate organizations
        external_id = uuid4().hex

        return {
            "name": name,
            "external_id": external_id,
            "metadata": {"domain_name": f"{url}{name}"},
        }

    def setup(self):
        from sentry.plugins.base import bindings

        bindings.add(
            "integration-repository.provider",
            CustomSCMRepositoryProvider,
            id="integrations:custom_scm",
        )
