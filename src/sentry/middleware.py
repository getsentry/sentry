from sentry.app import env
from sentry.conf import settings
from sentry.models import UserOption
from django.core.urlresolvers import reverse


class SentryMiddleware(object):
    def process_request(self, request):
        # HACK: bootstrap some env crud if we haven't yet
        if not settings.URL_PREFIX:
            settings.URL_PREFIX = request.build_absolute_uri(reverse('sentry')).strip('/')

        # bind request to env
        env.request = request

        self.load_user_conf(request)

    def load_user_conf(self, request):
        if not request.user.is_authenticated():
            return

        language = UserOption.objects.get_value(user=request.user, project=None, key='language', default=None)
        if language:
            request.session['django_language'] = language
