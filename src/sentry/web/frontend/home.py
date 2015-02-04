from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect

from sentry.web.frontend.base import BaseView


class HomeView(BaseView):
    def get(self, request):
        # TODO(dcramer): deal with case when the user cannot create orgs
        organization = self.get_active_organization(request)
        if organization is None:
            url = reverse('sentry-create-organization')
        else:
            url = reverse('sentry-organization-home', args=[organization.slug])
        return HttpResponseRedirect(url)
