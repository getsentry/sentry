from django.contrib.auth.models import AnonymousUser
from rest_framework.authentication import BasicAuthentication
from rest_framework.exceptions import AuthenticationFailed

from sentry.models import ProjectKey


class KeyAuthentication(BasicAuthentication):
    def authenticate_credentials(self, userid, password):
        try:
            pk = ProjectKey.objects.get_from_cache(public_key=userid)
        except ProjectKey.DoesNotExist:
            raise AuthenticationFailed('Invalid api key')

        if pk.secret_key != password:
            raise AuthenticationFailed('Invalid api key')

        if not pk.roles.api:
            raise AuthenticationFailed('Key does not allow API access')

        return (AnonymousUser(), pk)


class QuietBasicAuthentication(BasicAuthentication):
    def authenticate_header(self, request):
        return 'xBasic realm="%s"' % self.www_authenticate_realm
