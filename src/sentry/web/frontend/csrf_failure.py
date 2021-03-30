from django.middleware.csrf import REASON_NO_REFERER
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View

from sentry.web.helpers import render_to_response


class CsrfFailureView(View):
    @method_decorator(csrf_exempt)
    def dispatch(self, request, reason=""):
        context = {"no_referer": reason == REASON_NO_REFERER}

        return render_to_response("sentry/403-csrf-failure.html", context, request, status=403)


view = CsrfFailureView.as_view()
