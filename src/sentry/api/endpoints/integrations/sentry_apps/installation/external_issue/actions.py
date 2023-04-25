from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases import SentryAppInstallationBaseEndpoint
from sentry.api.serializers import serialize
from sentry.mediators.external_issues import IssueLinkCreator
from sentry.models import Group, Project
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.user import User
from sentry.services.hybrid_cloud.app import app_service
from sentry.services.hybrid_cloud.user.impl import serialize_rpc_user


@region_silo_endpoint
class SentryAppInstallationExternalIssueActionsEndpoint(SentryAppInstallationBaseEndpoint):
    def post(self, request: Request, installation) -> Response:
        data = request.data.copy()

        if not {"groupId", "action", "uri"}.issubset(data.keys()):
            return Response(status=400)

        group_id = data.get("groupId")
        del data["groupId"]

        try:
            group = Group.objects.get(
                id=group_id,
                project_id__in=Project.objects.filter(organization_id=installation.organization_id),
            )
        except Group.DoesNotExist:
            return Response(status=404)

        action = data["action"]
        del data["action"]

        uri = data.get("uri")
        del data["uri"]

        try:
            if isinstance(installation, SentryAppInstallation):
                installation = app_service.serialize_sentry_app_installation(
                    installation, installation.sentry_app
                )
            user = request.user
            if isinstance(request.user, User):
                user = serialize_rpc_user(request.user)
            external_issue = IssueLinkCreator.run(
                install=installation,
                group=group,
                action=action,
                fields=data,
                uri=uri,
                user=user,
            )
        except Exception:
            return Response({"error": "Error communicating with Sentry App service"}, status=400)

        return Response(serialize(external_issue))
