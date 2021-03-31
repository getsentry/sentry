from rest_framework.response import Response

from sentry import options
from sentry.api.base import Endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.utils.email import send_mail


class InternalMailEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request):
        data = {
            "mailHost": options.get("mail.host"),
            "mailPassword": bool(options.get("mail.password")),
            "mailUsername": options.get("mail.username"),
            "mailPort": options.get("mail.port"),
            "mailUseTls": options.get("mail.use-tls"),
            "mailUseSsl": options.get("mail.use-ssl"),
            "mailFrom": options.get("mail.from"),
            "mailListNamespace": options.get("mail.list-namespace"),
            "testMailEmail": request.user.email,
        }

        return Response(data)

    def post(self, request):
        error = None

        body = (
            """This email was sent as a request to test the Sentry outbound email configuration."""
        )
        try:
            send_mail(
                "{} Test Email".format(options.get("mail.subject-prefix")),
                body,
                options.get("mail.from"),
                [request.user.email],
                fail_silently=False,
            )
        except Exception as e:
            error = str(e)

        return Response({"error": error}, status=500 if error else 200)
