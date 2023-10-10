import logging

from django.db import router, transaction
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.permissions import SuperuserPermission
from sentry.api.serializers import serialize
from sentry.models.userrole import UserRole, UserRoleUser

audit_logger = logging.getLogger("sentry.audit.user")


@control_silo_endpoint
class UserUserRoleDetailsEndpoint(UserEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "GET": ApiPublishStatus.UNKNOWN,
        "POST": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (SuperuserPermission,)

    def get(self, request: Request, user, role_name) -> Response:
        # XXX(dcramer): we may decide to relax "view" permission over time, but being more restrictive by default
        # is preferred
        if not request.access.has_permission("users.admin"):
            return self.respond(status=403)

        try:
            role = UserRole.objects.get(users=user, name=role_name)
        except UserRole.DoesNotExist:
            return self.respond({"detail": f"'{role_name}' is not a known role."}, status=404)
        return self.respond(serialize(role, request.user))

    @sudo_required
    def post(self, request: Request, user, role_name) -> Response:
        if not request.access.has_permission("users.admin"):
            return self.respond(status=403)

        try:
            role = UserRole.objects.get(name=role_name)
        except UserRole.DoesNotExist:
            return self.respond({"detail": f"'{role_name}' is not a known role."}, status=404)

        with transaction.atomic(using=router.db_for_write(UserRoleUser)):
            _, created = UserRoleUser.objects.get_or_create(user=user, role=role)
            if not created:
                # Already exists.
                return self.respond(status=status.HTTP_410_GONE)

            audit_logger.info(
                "user.add-role",
                extra={
                    "actor_id": request.user.id,
                    "user_id": user.id,
                    "role_id": role.id,
                },
            )

        return self.respond(status=201)

    @sudo_required
    def delete(self, request: Request, user, role_name) -> Response:
        if not request.access.has_permission("users.admin"):
            return self.respond(status=403)

        try:
            role = UserRole.objects.get(users=user, name=role_name)
        except UserRole.DoesNotExist:
            return self.respond({"detail": f"'{role_name}' is not a known role."}, status=404)

        with transaction.atomic(using=router.db_for_write(UserRoleUser)):
            role.users.remove(user)
            audit_logger.info(
                "user.remove-role",
                extra={
                    "actor_id": request.user.id,
                    "user_id": user.id,
                    "role_id": role.id,
                },
            )
        return self.respond(status=204)
