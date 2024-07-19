from django.http import HttpResponse
from rest_framework.request import Request

from sentry.web.frontend.base import BaseView, control_silo_view
from sentry.web.helpers import render_to_response


@control_silo_view
class AuthCloseView(BaseView):
    """This is a view to handle when sentry log in has been opened from
    another window. This view loads an html page with a script that sends a message
    back to the window opener and closes the window"""

    def handle(self, request: Request) -> HttpResponse:
        logged_in = request.user.is_authenticated

        return render_to_response("sentry/auth_close.html", context={"logged_in": logged_in})
