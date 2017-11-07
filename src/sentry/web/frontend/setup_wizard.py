from __future__ import absolute_import

from django.core.cache import cache
from django.views.generic import View

from sentry.web.helpers import render_to_response


class SetupWizardView(View):
    def get(self, request, wizard_hash):
        key = 'setup-wizard-keys:v1:%s' % wizard_hash
        context = {
            'hash': wizard_hash
        }
        if cache.get(key) is not None:
            context['expired'] = True
        return render_to_response('sentry/setup-wizard.html', context, self.request)
