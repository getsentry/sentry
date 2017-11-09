from __future__ import absolute_import

from sentry import options
from sentry.models import User


class DemoAuthenticationMiddleware(object):
    def process_request(self, request):
        demo_header = 'HTTP_X_DEMO' in request.META
        demo_path = 'api/0/' in request.path
        demo_method = request.method == 'GET'
        demo_user = options.get('auth.demo-user')

        if all([demo_header, demo_path, demo_method, demo_user]):
            request.user = User.objects.get(username=demo_user)
