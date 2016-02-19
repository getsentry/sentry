from __future__ import absolute_import

from django.contrib.auth.models import AnonymousUser
from django.utils.crypto import constant_time_compare
from rest_framework.authentication import BasicAuthentication
from rest_framework.exceptions import AuthenticationFailed

from sentry import options
from sentry.app import raven
from sentry.models import ApiKey, ProjectKey
from sentry.models.apikey import SYSTEM_KEY


class QuietBasicAuthentication(BasicAuthentication):
    def authenticate_header(self, request):
        return 'xBasic realm="%s"' % self.www_authenticate_realm


class ApiKeyAuthentication(QuietBasicAuthentication):
    def authenticate_credentials(self, userid, password):
        if userid == 'admin':
            ref_pw = options.get('system.admin-auth-password')
            if not ref_pw:
                raise AuthenticationFailed('System admin authentication disabled')
            if not constant_time_compare(ref_pw, password):
                raise AuthenticationFailed('Invalid system admin password')
            return (None, SYSTEM_KEY)

        if password:
            return

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


class ProjectKeyAuthentication(QuietBasicAuthentication):
    def authenticate_credentials(self, userid, password):
        try:
            pk = ProjectKey.objects.get_from_cache(public_key=userid)
        except ProjectKey.DoesNotExist:
            return None

        if not constant_time_compare(pk.secret_key, password):
            return None

        if not pk.is_active:
            raise AuthenticationFailed('Key is disabled')

        if not pk.roles.api:
            raise AuthenticationFailed('Key does not allow API access')

        return (AnonymousUser(), pk)
