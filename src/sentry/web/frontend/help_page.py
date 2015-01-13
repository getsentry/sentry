from __future__ import absolute_import, print_function

from django.http import Http404

from sentry.models import HelpPage
from sentry.web.frontend.base import BaseView


class HelpPageView(BaseView):
    auth_required = False

    def get(self, request, page_id, page_slug=None):
        try:
            page = HelpPage.objects.get_from_cache(id=page_id)
        except HelpPage.DoesNotExist:
            raise Http404

        if not (page.is_visible or request.user.is_staff):
            raise Http404

        context = {
            'page': page,
        }

        return self.respond('sentry/help/basic_page.html', context)
