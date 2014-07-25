from __future__ import absolute_import, print_function

from django.views.generic import View

from sentry.models import HelpPage
from sentry.web.helpers import render_to_response


class HelpIndexView(View):

    def get(self, request):
        pages = list(HelpPage.objects.filter(is_visible=True))
        pages.sort(key=lambda x: (-x.priority, x.title))

        context = {
            'page_list': pages,
        }

        return render_to_response('sentry/help/index.html', context, request)
