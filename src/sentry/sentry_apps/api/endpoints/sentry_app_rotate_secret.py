import logging

from django.http import Http404
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.permissions import DemoSafePermission
from sentry.api.serializers import serialize
from sentry.auth.superuser import superuser_has_permission
from sentry.constants import SentryAppStatus
from sentry.models.apiapplication import generate_token
from sentry.organizations.services.organization import organization_service
from sentry.sentry_apps.api.bases.sentryapps import SentryAppBaseEndpoint
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.users.services.user.service import user_service

logger = logging.getLogger(__name__)


class SentryAppRotateSecretPermission(DemoSafePermission):
    scope_map = {
        "POST": ["org:write", "org:admin"],
    }

    def has_object_permission(self, request: Request, view: object, sentry_app: SentryApp):
        log_info = {
            "user_id": request.user.id,
            "sentry_app_name": sentry_app.name,
            "organization_id": sentry_app.owner_id,
        }

        # organization that owns an integration
        org_context = organization_service.get_organization_by_id(
            id=sentry_app.owner_id, user_id=request.user.id if request.user else None
        )
        if org_context is None:
            logger.warning("owner organization for a sentry app was not found", extra=log_info)
            raise Http404

        self.determine_access(request, org_context)

        if superuser_has_permission(request):
            return True

        # if user is not a member of an organization owning an integration,
        # return 404 to avoid leaking integration slug
        organizations = (
            user_service.get_organizations(user_id=request.user.id)
            if request.user.id is not None
            else ()
        )
        if not any(sentry_app.owner_id == org.id for org in organizations):
            logger.info(
                "user does not belong to the integration owner organization", extra=log_info
            )
            raise Http404

        # permission check inside an organization
        allowed_scopes = set(self.scope_map.get(request.method or "", []))
        return any(request.access.has_scope(s) for s in allowed_scopes)


@control_silo_endpoint
class SentryAppRotateSecretEndpoint(SentryAppBaseEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE
    permission_classes = (SentryAppRotateSecretPermission,)

    def post(self, request: Request, sentry_app: SentryApp) -> Response:
        if sentry_app.application is None:
            return Response({"detail": "Corresponding application was not found."}, status=404)

        new_token = generate_token()
        sentry_app.application.update(client_secret=new_token)
        self.create_audit_entry(
            request=self.request,
            organization_id=sentry_app.owner_id,
            target_object=sentry_app.id,
            event=audit_log.get_event_id("INTEGRATION_ROTATE_CLIENT_SECRET"),
            data={
                "sentry_app": sentry_app.name,
                "status": SentryAppStatus.as_str(sentry_app.status),
            },
        )

        return Response(serialize({"clientSecret": new_token}))
