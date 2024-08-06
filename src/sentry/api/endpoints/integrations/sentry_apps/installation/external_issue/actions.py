from django.utils.functional import empty
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import SentryAppInstallationBaseEndpoint
from sentry.api.serializers import serialize
from sentry.mediators.external_issues.issue_link_creator import IssueLinkCreator
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.users.models.user import User
from sentry.users.services.user.serial import serialize_rpc_user


def _extract_lazy_object(lo):
    """
    Unwrap a LazyObject and return the inner object. Whatever that may be.

    ProTip: This is relying on `django.utils.functional.empty`, which may
    or may not be removed in the future. It's 100% undocumented.
    """
    if not hasattr(lo, "_wrapped"):
        return lo
    if lo._wrapped is empty:
        lo._setup()
    return lo._wrapped


@region_silo_endpoint
class SentryAppInstallationExternalIssueActionsEndpoint(SentryAppInstallationBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

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

        action = data.pop("action")
        uri = data.pop("uri")

        try:
            user = _extract_lazy_object(request.user)
            if isinstance(user, User):
                user = serialize_rpc_user(user)

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
