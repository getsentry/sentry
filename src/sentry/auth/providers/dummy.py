from __future__ import absolute_import, print_function

from django.http import HttpResponse

from sentry.auth import Provider, AuthView


class AskEmail(AuthView):
    def dispatch(self, request, helper):
        if 'email' in request.POST:
            helper.bind_state('email', request.POST['email'])
            return helper.next_step()

        return HttpResponse(DummyProvider.TEMPLATE)


class DummyProvider(Provider):
    TEMPLATE = '<form method="POST"><input type="email" name="email" /></form>'

    def get_auth_pipeline(self):
        return [AskEmail()]

    def build_identity(self, state):
        return {
            'name': 'Dummy',
            'id': state['email'],
            'email': state['email'],
        }

    def refresh_identity(self, auth_identity):
        pass

    def build_config(self, state):
        return {}
