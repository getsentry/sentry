from __future__ import absolute_import, print_function

from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect, Http404
from django.views.decorators.cache import never_cache
from django.utils.translation import ugettext_lazy as _

from sentry.models import Integration, Identity, IdentityProvider, IdentityStatus, Organization
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign, unsign
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response

SLACK_IDENTITY_LINKED = _("Your Slack identity has been associated with your Sentry account")


def build_linking_url(integration, organization, slack_id):
    signed_params = sign(
        integration_id=integration.id,
        organization_id=organization.id,
        slack_id=slack_id,
    )

    return absolute_uri(reverse('sentry-integration-slack-link-identity', kwargs={
        'signed_params': signed_params,
    }))


class SlackLinkIdentitiyView(BaseView):
    @never_cache
    def handle(self, request, signed_params):
        params = unsign(signed_params.encode('ascii', errors='ignore'))

        try:
            organization = Organization.objects.get(
                id__in=request.user.get_orgs(),
                id=params['organization_id'],
            )
        except Organization.DoesNotExist:
            raise Http404

        try:
            integration = Integration.objects.get(
                id=params['integration_id'],
                organizations=organization,
            )
        except Integration.DoesNotExist:
            raise Http404

        try:
            idp = IdentityProvider.objects.get(
                type='slack',
                organization=organization,
            )
        except Integration.DoesNotExist:
            raise Http404

        if request.method != 'POST':
            return render_to_response('sentry/auth-link-identity.html', request=request, context={
                'organization': organization,
                'provider': integration.get_provider(),
            })

        # TODO(epurkhiser): We could do some fancy slack querying here to
        # render a nice linking page with info about the user their linking.

        Identity.objects.get_or_create(
            external_id=params['slack_id'],
            user=request.user,
            idp=idp,
            status=IdentityStatus.VALID,
        )

        messages.add_message(self.request, messages.SUCCESS, SLACK_IDENTITY_LINKED)

        return HttpResponseRedirect('/')
