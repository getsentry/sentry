from django.contrib import messages
from django.http import HttpResponseRedirect
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from sentry import features, options
from sentry.integrations.base import IntegrationDomain
from sentry.integrations.utils.metrics import (
    IntegrationPipelineViewEvent,
    IntegrationPipelineViewType,
)
from sentry.models.organization import Organization
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.pipeline import Pipeline, PipelineProvider
from sentry.users.models.identity import Identity, IdentityProvider
from sentry.utils import metrics

from . import default_manager

IDENTITY_LINKED = _("Your {identity_provider} account has been associated with your Sentry account")


class IdentityProviderPipeline(Pipeline):
    pipeline_name = "identity_provider"
    provider_manager = default_manager
    provider_model_cls = IdentityProvider

    # TODO(iamrajjoshi): Delete this after Azure DevOps migration is complete
    def get_provider(self, provider_key: str, **kwargs) -> PipelineProvider:
        if kwargs.get("organization"):
            organization: Organization | RpcOrganization = kwargs["organization"]
        if provider_key == "vsts" and features.has(
            "organizations:migrate-azure-devops-integration", organization
        ):
            provider_key = "vsts_new"
        # TODO(iamrajjoshi): Delete this after Azure DevOps migration is complete
        if provider_key == "vsts_login" and options.get("vsts.social-auth-migration"):
            provider_key = "vsts_login_new"

        return super().get_provider(provider_key)

    def finish_pipeline(self):
        with IntegrationPipelineViewEvent(
            IntegrationPipelineViewType.IDENTITY_LINK,
            IntegrationDomain.IDENTITY,
            self.provider.key,
        ).capture():
            # NOTE: only reached in the case of linking a new identity
            # via Social Auth pipelines
            identity = self.provider.build_identity(self.state.data)

            Identity.objects.link_identity(
                user=self.request.user,
                idp=self.provider_model,
                external_id=identity["id"],
                should_reattach=False,
                defaults={
                    "scopes": identity.get("scopes", []),
                    "data": identity.get("data", {}),
                },
            )

            messages.add_message(
                self.request,
                messages.SUCCESS,
                IDENTITY_LINKED.format(identity_provider=self.provider.name),
            )
            metrics.incr(
                "identity_provider_pipeline.finish_pipeline",
                tags={
                    "provider": self.provider.key,
                },
                skip_internal=False,
            )

            self.state.clear()

            # TODO(epurkhiser): When we have more identities and have built out an
            # identity management page that supports these new identities (not
            # social-auth ones), redirect to the identities page.
            return HttpResponseRedirect(reverse("sentry-account-settings"))
