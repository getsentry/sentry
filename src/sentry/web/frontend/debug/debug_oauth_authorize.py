from __future__ import absolute_import, print_function

from django.views.generic import View

from sentry.models import ApiApplication
from sentry.web.helpers import render_to_response


class DebugOAuthAuthorizeView(View):
    def get(self, request):
        application = ApiApplication(
            name='Example Application',
            homepage_url='http://example.com',
            terms_url='http://example.com/terms',
            privacy_url='http://example.com/privacy',
        )
        return render_to_response('sentry/oauth-authorize.html', {
            'user': request.user,
            'application': application,
            'scopes': ['org:read', 'project:write'],
            'permissions': [
                'Read access to organization details.',
                'Read and write access to projects.',
            ],
        }, request)
