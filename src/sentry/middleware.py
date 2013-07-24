from sentry.app import env
from sentry.models import UserOption
from sentry.utils.http import absolute_uri
from django.conf import settings
from django.core.urlresolvers import reverse
from social_auth.middleware import SocialAuthExceptionMiddleware


class SentryMiddleware(object):
    def process_request(self, request):
        # HACK: bootstrap some env crud if we haven't yet
        if not settings.SENTRY_URL_PREFIX:
            settings.SENTRY_URL_PREFIX = request.build_absolute_uri(reverse('sentry')).strip('/')

        # bind request to env
        env.request = request

        self.load_user_conf(request)

    def load_user_conf(self, request):
        if not request.user.is_authenticated():
            return

        language = UserOption.objects.get_value(user=request.user, project=None, key='language', default=None)
        if language:
            request.session['django_language'] = language


class SentrySocialAuthExceptionMiddleware(SocialAuthExceptionMiddleware):
    def get_redirect_uri(self, request, exception):
        return absolute_uri(reverse('sentry-login'))
