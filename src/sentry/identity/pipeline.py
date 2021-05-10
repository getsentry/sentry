import logging

from django.contrib import messages
from django.http import HttpResponseRedirect
from django.urls import reverse
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.models import Identity, IdentityProvider, IdentityStatus
from sentry.pipeline import Pipeline

from . import default_manager

IDENTITY_LINKED = _("Your {identity_provider} account has been associated with your Sentry account")

logger = logging.getLogger("sentry.identity")


class IdentityProviderPipeline(Pipeline):
    logger = logger

    pipeline_name = "identity_provider"
    provider_manager = default_manager
    provider_model_cls = IdentityProvider

    def redirect_url(self):
        associate_url = reverse(
            "sentry-extension-setup",
            kwargs={
                # TODO(adhiraj): Remove provider_id from the callback URL, it's unused.
                "provider_id": "default"
            },
        )

        # Use configured redirect_url if specified for the pipeline if available
        return self.config.get("redirect_url", associate_url)

    def finish_pipeline(self):
        identity = self.provider.build_identity(self.state.data)

        defaults = {
            "status": IdentityStatus.VALID,
            "scopes": identity.get("scopes", []),
            "data": identity.get("data", {}),
            "date_verified": timezone.now(),
        }

        identity, created = Identity.objects.get_or_create(
            idp=self.provider_model,
            user=self.request.user,
            external_id=identity["id"],
            defaults=defaults,
        )

        if not created:
            identity.update(**defaults)

        messages.add_message(
            self.request,
            messages.SUCCESS,
            IDENTITY_LINKED.format(identity_provider=self.provider.name),
        )

        self.state.clear()

        # TODO(epurkhiser): When we have more identities and have built out an
        # identity management page that supports these new identities (not
        # social-auth ones), redirect to the identities page.
        return HttpResponseRedirect(reverse("sentry-account-settings"))
