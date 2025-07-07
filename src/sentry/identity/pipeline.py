from __future__ import annotations

from collections.abc import Callable, Sequence
from functools import cached_property

from django.contrib import messages
from django.http.response import HttpResponseBase, HttpResponseRedirect
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from sentry import features, options
from sentry.identity.base import Provider
from sentry.integrations.base import IntegrationDomain
from sentry.integrations.utils.metrics import (
    IntegrationPipelineViewEvent,
    IntegrationPipelineViewType,
)
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.pipeline.base import Pipeline
from sentry.pipeline.store import PipelineSessionStore
from sentry.pipeline.views.base import PipelineView
from sentry.users.models.identity import Identity, IdentityProvider
from sentry.utils import metrics

from . import default_manager

IDENTITY_LINKED = _("Your {identity_provider} account has been associated with your Sentry account")


class IdentityPipeline(Pipeline[IdentityProvider, PipelineSessionStore]):
    pipeline_name = "identity_provider"
    provider_model_cls = IdentityProvider

    # TODO(iamrajjoshi): Delete this after Azure DevOps migration is complete
    def _get_provider(self, provider_key: str, organization: RpcOrganization | None) -> Provider:
        if provider_key == "vsts" and features.has(
            "organizations:migrate-azure-devops-integration", organization
        ):
            provider_key = "vsts_new"
        # TODO(iamrajjoshi): Delete this after Azure DevOps migration is complete
        if provider_key == "vsts_login" and options.get("vsts.social-auth-migration"):
            provider_key = "vsts_login_new"

        return default_manager.get(provider_key)

    @cached_property
    def provider(self) -> Provider:
        ret = self._get_provider(self._provider_key, self.organization)
        ret.set_pipeline(self)
        ret.update_config(self.config)
        return ret

    def get_pipeline_views(
        self,
    ) -> Sequence[PipelineView[IdentityPipeline] | Callable[[], PipelineView[IdentityPipeline]]]:
        return self.provider.get_pipeline_views()

    def finish_pipeline(self) -> HttpResponseBase:
        with IntegrationPipelineViewEvent(
            IntegrationPipelineViewType.IDENTITY_LINK,
            IntegrationDomain.IDENTITY,
            self.provider.key,
        ).capture():
            # NOTE: only reached in the case of linking a new identity
            # via Social Auth pipelines
            identity = self.provider.build_identity(self.state.data)

            assert self.request.user.is_authenticated
            assert self.provider_model is not None

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
