from __future__ import absolute_import

from django.utils.crypto import constant_time_compare
from rest_framework.authentication import BasicAuthentication
from rest_framework.exceptions import AuthenticationFailed

from sentry.app import raven
from sentry.models import AnonymousUser, ApiKey, ProjectKey


class QuietBasicAuthentication(BasicAuthentication):
    def authenticate_header(self, request):
        return 'xBasic realm="%s"' % self.www_authenticate_realm


class ApiKeyAuthentication(QuietBasicAuthentication):
    def authenticate_credentials(self, userid, password):
        if password:
            return

        try:
            key = ApiKey.objects.get_from_cache(key=userid)
        except ApiKey.DoesNotExist:
            return None

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
