from __future__ import absolute_import, print_function

import six

from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from sentry.models import (
    ApiApplication, ApiApplicationStatus, ApiGrant, ApiToken
)
from sentry.utils import json
from sentry.web.frontend.base import BaseView


class OAuthTokenView(BaseView):
    def error(self, name, status=400):
        return HttpResponse(json.dumps({
            'error': name,
        }), status=status)

    @csrf_exempt
    def post(self, request):
        grant_type = request.GET.get('grant_type')

        if grant_type == 'authorization_code':
            client_id = request.GET.get('client_id')
            redirect_uri = request.GET.get('redirect_uri')
            code = request.GET.get('code')

            if not client_id:
                return self.error('invalid_client')

            try:
                application = ApiApplication.objects.get(
                    client_id=client_id,
                    status=ApiApplicationStatus.active,
                )
            except ApiApplication.DoesNotExist:
                return self.error('invalid_client')

            try:
                grant = ApiGrant.objects.get(application=application, code=code)
            except ApiGrant.DoesNotExist:
                return self.error('invalid_grant')

            if grant.is_expired():
                return self.error('invalid_grant')

            if not redirect_uri:
                redirect_uri = application.get_default_redirect_uri()
            elif grant.redirect_uri != redirect_uri:
                return self.error('invalid_request')

            if grant.is_expired():
                return self.error('invalid_grant')

            token = ApiToken.from_grant(grant)
        elif grant_type == 'refresh_token':
            refresh_token = request.GET.get('refresh_token')
            scope = request.GET.get('scope')

            if not refresh_token:
                return self.error('invalid_grant')

            # TODO(dcramer): support scope
            if scope:
                return self.error('invalid_request')

            try:
                token = ApiToken.objects.get(
                    refresh_token=refresh_token,
                )
            except ApiToken.DoesNotExist:
                return self.error('invalid_grant')

            token.refresh()
        else:
            return self.error('unsupported_grant_type')

        return HttpResponse(json.dumps({
            'access_token': token.token,
            'refresh_token': token.refresh_token,
            'expires_in': (timezone.now() - token.expires_at).total_seconds(),
            'expires_at': token.expires_at,
            'token_type': 'bearer',
            'scope': ' '.join(k for k, v in token.scopes.iteritems() if v),  # NOQA
            'user': {
                'id': six.text_type(token.user.id),
            }
        }))
