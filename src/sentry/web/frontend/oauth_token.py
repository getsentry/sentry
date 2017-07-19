from __future__ import absolute_import, print_function

import six

from django.http import HttpResponse
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.generic.base import View

from sentry.models import (
    ApiApplication, ApiApplicationStatus, ApiGrant, ApiToken
)
from sentry.utils import json


class OAuthTokenView(View):
    @csrf_exempt
    @never_cache
    def dispatch(self, request, *args, **kwargs):
        return super(OAuthTokenView, self).dispatch(request, *args, **kwargs)

    def error(self, name, status=400):
        return HttpResponse(json.dumps({
            'error': name,
        }), content_type='application/json', status=status)

    @never_cache
    def post(self, request):
        grant_type = request.POST.get('grant_type')

        if grant_type == 'authorization_code':
            client_id = request.POST.get('client_id')
            client_secret = request.POST.get('client_secret')
            redirect_uri = request.POST.get('redirect_uri')
            code = request.POST.get('code')

            if not client_id:
                return self.error('invalid_client')

            if not client_secret:
                return self.error('invalid_client')

            try:
                application = ApiApplication.objects.get(
                    client_id=client_id,
                    status=ApiApplicationStatus.active,
                )
            except ApiApplication.DoesNotExist:
                return self.error('invalid_client')

            if not constant_time_compare(client_secret, application.client_secret):
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
                return self.error('invalid_grant')

            token = ApiToken.from_grant(grant)
        elif grant_type == 'refresh_token':
            refresh_token = request.POST.get('refresh_token')
            scope = request.POST.get('scope')
            client_id = request.POST.get('client_id')
            client_secret = request.POST.get('client_secret')

            if not refresh_token:
                return self.error('invalid_request')

            # TODO(dcramer): support scope
            if scope:
                return self.error('invalid_request')

            if not client_id:
                return self.error('invalid_client')

            if not client_secret:
                return self.error('invalid_client')

            try:
                application = ApiApplication.objects.get(
                    client_id=client_id,
                    status=ApiApplicationStatus.active,
                )
            except ApiApplication.DoesNotExist:
                return self.error('invalid_client')

            if not constant_time_compare(client_secret, application.client_secret):
                return self.error('invalid_client')

            try:
                token = ApiToken.objects.get(
                    application=application,
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
            'scope': ' '.join(token.get_scopes()),  # NOQA
            'user': {
                'id': six.text_type(token.user.id),
                # we might need these to become scope based
                'name': token.user.name,
                'email': token.user.email,
            },
        }), content_type='application/json')
