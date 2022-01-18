import logging

from django.db import IntegrityError, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.decorators import sudo_required
from sentry.api.permissions import SuperuserPermission
from sentry.api.serializers import serialize
from sentry.api.validators.userrole import UserRoleValidator
from sentry.models import UserRole

audit_logger = logging.getLogger("sentry.audit.user")


class UserRoleDetailsEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    @sudo_required
    def get(self, request: Request, role_name) -> Response:
        # XXX(dcramer): we may decide to relax "view" permission over time, but being more restrictive by default
        # is preferred
        if not request.access.has_permission("users.admin"):
            return self.respond(status=403)

        try:
            role = UserRole.objects.get(name=role_name)
        except UserRole.DoesNotExist:
            return self.respond({"detail": f"'{role_name}' is not a known role."}, status=404)
        return self.respond(serialize(role, user=request.user))

    @sudo_required
    def put(self, request: Request, role_name) -> Response:
        if not request.access.has_permission("users.admin"):
            return self.respond(status=403)

        try:
            role = UserRole.objects.get(name=role_name)
        except UserRole.DoesNotExist:
            return self.respond({"detail": f"'{role_name}' is not a known role."}, status=404)

        validator = UserRoleValidator(data=request.data, partial=True)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.validated_data
        try:
            with transaction.atomic():
                if "name" in result:
                    role.name = result["name"]
                if "permissions" in result:
                    role.permissions = result["permissions"]
                role.save(update_fields=result.keys())
                audit_logger.info(
                    "user-roles.edit",
                    extra={
                        "actor_id": request.user.id,
                        "role_id": role.id,
                        "form_data": request.data,
                    },
                )
        except IntegrityError as e:
            if "already exists" in str(e):
                return self.respond(status=410)
            raise

        return self.respond(serialize(role, user=request.user))

    @sudo_required
    def delete(self, request: Request, role_name) -> Response:
        if not request.access.has_permission("users.admin"):
            return self.respond(status=403)

        try:
            role = UserRole.objects.get(name=role_name)
        except UserRole.DoesNotExist:
            return self.respond({"detail": f"'{role_name}' is not a known role."}, status=404)

        with transaction.atomic():
            role.delete()
            audit_logger.info(
                "user-roles.delete",
                extra={
                    "actor_id": request.user.id,
                    "role_id": role.id,
                },
            )
        return self.respond(status=204)
