from django.http import Http404
from django.views.generic import View

from sentry.models import HelpPage
from sentry.web.helpers import render_to_response


class HelpPageView(View):

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

        return render_to_response('sentry/help/basic_page.html', context, request)
