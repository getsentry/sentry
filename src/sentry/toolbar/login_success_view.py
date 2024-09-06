from django.http import HttpRequest, HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View

from sentry.web.helpers import render_to_response


class LoginSuccessView(View):
    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        if request.method != "GET":
            return HttpResponse(status=405)

        return render_to_response("sentry/toolbar/login_success.html")
