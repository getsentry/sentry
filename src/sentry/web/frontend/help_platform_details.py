from __future__ import absolute_import

from django.http import Http404

from sentry.constants import PLATFORM_LIST, PLATFORM_TITLES
from sentry.web.helpers import render_to_string
from sentry.web.frontend.help_platform_base import HelpPlatformBaseView


class HelpPlatformDetailsView(HelpPlatformBaseView):
    def get(self, request, platform, project_list, selected_project):
        if platform not in PLATFORM_LIST:
            raise Http404

        template = 'sentry/partial/client_config/%s.html' % (platform,)

        context = self.get_context_data(request, project_list, selected_project)
        context.update({
            'platform': platform,
            'platform_title': PLATFORM_TITLES.get(platform, platform.title()),
        })

        context['template'] = render_to_string(template, context, request)

        return self.respond('sentry/help/platform_details.html', context)
