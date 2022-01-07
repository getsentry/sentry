from rest_framework.request import Request
from rest_framework.response import Response

from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response


class AuthCloseView(BaseView):
    """This is a view to handle when sentry log in has been opened from
    another window. This view loads an html page with a script that sends a message
    back to the window opener and closes the window"""

    def handle(self, request: Request) -> Response:
        logged_in = request.user.is_authenticated

        return render_to_response("sentry/auth_close.html", context={"logged_in": logged_in})
