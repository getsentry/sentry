from __future__ import absolute_import

from django.contrib.auth.models import AnonymousUser
from rest_framework.authentication import BasicAuthentication
from rest_framework.exceptions import AuthenticationFailed

from sentry import options
from sentry.app import raven
from sentry.models import ApiKey
from sentry.models.apikey import ROOT_KEY
from django.utils.crypto import constant_time_compare


class QuietBasicAuthentication(BasicAuthentication):
    def authenticate_header(self, request):
        return 'xBasic realm="%s"' % self.www_authenticate_realm


class ApiKeyAuthentication(QuietBasicAuthentication):
    def authenticate_credentials(self, userid, password):
        if password:
            return

        root_api_key = options.get('system.root-api-key')
        if root_api_key:
            if constant_time_compare(root_api_key, userid):
                return (None, ROOT_KEY)

        try:
            key = ApiKey.objects.get_from_cache(key=userid)
        except ApiKey.DoesNotExist:
            raise AuthenticationFailed('API key is not valid')

        if not key.is_active:
            raise AuthenticationFailed('Key is disabled')

        raven.tags_context({
            'api_key': userid,
        })

        return (AnonymousUser(), key)
