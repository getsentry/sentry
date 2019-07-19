from __future__ import absolute_import

from social_auth.middleware import SocialAuthExceptionMiddleware

from sentry.utils import auth
from sentry.utils.http import absolute_uri


class SentrySocialAuthExceptionMiddleware(SocialAuthExceptionMiddleware):
    def get_redirect_uri(self, request, exception):
        return absolute_uri(auth.get_login_url())
