from __future__ import absolute_import, print_function

from sentry.web.frontend.help_platform_base import HelpPlatformBaseView


class HelpPlatformIndexView(HelpPlatformBaseView):
    def get(self, request, project_list, selected_project):
        return self.respond('sentry/help/platform_index.html')
