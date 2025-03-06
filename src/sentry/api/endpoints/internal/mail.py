from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.utils.email import send_mail


@all_silo_endpoint
class InternalMailEndpoint(Endpoint):
    owner = ApiOwner.OPEN_SOURCE
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (SuperuserPermission,)

    def get(self, request: Request) -> Response:
        assert request.user.is_authenticated
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

    def post(self, request: Request) -> Response:
        assert request.user.is_authenticated
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
