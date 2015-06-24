from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect

from sentry import features
from sentry.web.frontend.base import BaseView


class HomeView(BaseView):
    def get(self, request):
        # TODO(dcramer): deal with case when the user cannot create orgs
        organization = self.get_active_organization(request)
        if organization:
            url = reverse('sentry-organization-home', args=[organization.slug])
        elif not features.has('organizations:create'):
            return self.respond('sentry/no-organization-access.html', status=403)
        else:
            url = reverse('sentry-create-organization')
        return HttpResponseRedirect(url)
