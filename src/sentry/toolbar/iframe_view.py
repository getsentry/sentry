from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View
from rest_framework.response import Response

from sentry.web.frontend.base import region_silo_view
from sentry.web.helpers import render_to_response


@region_silo_view
class IframeView(View):
    """
    (description)
    """

    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        if request.method != "GET":
            return Response(status=405)

        return render_to_response("sentry/toolbar/iframe.html", status=200, request=request)
