from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect

from sentry.web.frontend.base import BaseView


class HomeView(BaseView):
    def get(self, request):
        # TODO(dcramer): deal with no orgs
        organization = self.get_active_organization(request)
        url = reverse('sentry-organization-home', args=[organization.id])
        return HttpResponseRedirect(url)
