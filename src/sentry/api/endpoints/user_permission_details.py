import logging

from django.conf import settings
from django.db import IntegrityError, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.permissions import SuperuserPermission
from sentry.models import UserPermission

audit_logger = logging.getLogger("sentry.audit.user")


@control_silo_endpoint
class UserPermissionDetailsEndpoint(UserEndpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request: Request, user, permission_name) -> Response:
        # XXX(dcramer): we may decide to relax "view" permission over time, but being more restrictive by default
        # is preferred
        if not request.access.has_permission("users.admin"):
            return self.respond(status=403)

        has_perm = UserPermission.objects.filter(user=user, permission=permission_name).exists()
        return self.respond(status=204 if has_perm else 404)

    @sudo_required
    def post(self, request: Request, user, permission_name) -> Response:
        if not request.access.has_permission("users.admin"):
            return self.respond(status=403)

        if permission_name not in settings.SENTRY_USER_PERMISSIONS:
            return self.respond(
                {"detail": f"'{permission_name}' is not a known permission."}, status=404
            )

        try:
            with transaction.atomic():
                UserPermission.objects.create(user=user, permission=permission_name)
                audit_logger.info(
                    "user.add-permission",
                    extra={
                        "actor_id": request.user.id,
                        "user_id": user.id,
                        "permission_name": permission_name,
                    },
                )
        except IntegrityError as e:
            if "already exists" in str(e):
                return self.respond(status=410)
            raise
        return self.respond(status=201)

    @sudo_required
    def delete(self, request: Request, user, permission_name) -> Response:
        if not request.access.has_permission("users.admin"):
            return self.respond(status=403)

        with transaction.atomic():
            deleted, _ = UserPermission.objects.filter(
                user=user, permission=permission_name
            ).delete()
            if deleted:
                audit_logger.info(
                    "user.delete-permission",
                    extra={
                        "actor_id": request.user.id,
                        "user_id": user.id,
                        "permission_name": permission_name,
                    },
                )

        if deleted:
            return self.respond(status=204)
        return self.respond(status=404)
