from django.http import Http404
from django.views.generic import View

from sentry.constants import PLATFORM_LIST, PLATFORM_TITLES
from sentry.web.helpers import render_to_response, render_to_string


class HelpPlatformDetailsView(View):

    def get(self, request, platform):
        if platform not in PLATFORM_LIST:
            raise Http404

        template = 'sentry/partial/client_config/%s.html' % (platform,)

        context = {
            'platform': platform,
            'platform_title': PLATFORM_TITLES.get(platform, platform.title()),
        }

        context['template'] = render_to_string(template, context, request)

        return render_to_response('sentry/help/platform_details.html', context, request)
