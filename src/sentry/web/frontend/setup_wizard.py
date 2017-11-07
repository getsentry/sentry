from __future__ import absolute_import

from django.core.cache import cache
from django.utils.decorators import method_decorator

from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response
from sentry.web.decorators import login_required


class SetupWizardView(BaseView):

    @method_decorator(login_required)
    def get(self, request, wizard_hash):
        key = 'setup-wizard-keys:v1:%s' % wizard_hash
        context = {
            'hash': wizard_hash
        }
        if cache.get(key) is not None:
            context['expired'] = True

        return render_to_response('sentry/setup-wizard.html', context, self.request)
