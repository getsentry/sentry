from __future__ import absolute_import

from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response


class SetupWizardView(BaseView):

    def get(self, request, wizard_hash):
        context = {
            'hash': wizard_hash
        }
        return render_to_response('sentry/setup-wizard.html', context, self.request)
