from __future__ import absolute_import

from django.contrib.auth.models import AnonymousUser
from django.utils.crypto import constant_time_compare
from rest_framework.authentication import BasicAuthentication
from rest_framework.exceptions import AuthenticationFailed

from sentry.models import ApiKey, ProjectKey


class QuietBasicAuthentication(BasicAuthentication):
    def authenticate_header(self, request):
        return 'xBasic realm="%s"' % self.www_authenticate_realm


class ApiKeyAuthentication(QuietBasicAuthentication):
    def authenticate_credentials(self, userid, password):
        if password:
            raise AuthenticationFailed('A password should not be specified')

        try:
            key = ApiKey.objects.get_from_cache(key=userid)
        except ApiKey.DoesNotExist:
            raise AuthenticationFailed('Invalid api key')

        if not key.is_active:
            raise AuthenticationFailed('Key is disabled')

        return (AnonymousUser(), key)


class ProjectKeyAuthentication(QuietBasicAuthentication):
    def authenticate_credentials(self, userid, password):
        try:
            pk = ProjectKey.objects.get_from_cache(public_key=userid)
        except ProjectKey.DoesNotExist:
            raise AuthenticationFailed('Invalid api key')

        if not constant_time_compare(pk.secret_key, password):
            raise AuthenticationFailed('Invalid api key')

        if not pk.is_active:
            raise AuthenticationFailed('Key is disabled')

        if not pk.roles.api:
            raise AuthenticationFailed('Key does not allow API access')

        return (AnonymousUser(), pk)
