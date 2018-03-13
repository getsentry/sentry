from __future__ import absolute_import, print_function

from django.http import HttpResponse

from sentry.auth import Provider, AuthView
from sentry.auth.provider import MigratingIdentityId


class AskEmail(AuthView):
    def dispatch(self, request, helper):
        if 'email' in request.POST:
            helper.bind_state('email', request.POST.get('email'))
            helper.bind_state('legacy_email', request.POST.get('legacy_email'))
            return helper.next_step()

        return HttpResponse(DummyProvider.TEMPLATE)


class DummyProvider(Provider):
    TEMPLATE = '<form method="POST"><input type="email" name="email" /></form>'
    name = 'Dummy'

    def get_auth_pipeline(self):
        return [AskEmail()]

    def build_identity(self, state):
        return {
            'id': MigratingIdentityId(id=state['email'], legacy_id=state.get('legacy_email')),
            'email': state['email'],
            'name': 'Dummy',
        }

    def refresh_identity(self, auth_identity):
        pass

    def build_config(self, state):
        return {}
