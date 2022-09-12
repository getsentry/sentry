import logging

from django.db import IntegrityError, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.decorators import sudo_required
from sentry.api.permissions import SuperuserPermission
from sentry.api.serializers import serialize
from sentry.api.validators.userrole import UserRoleValidator
from sentry.models import UserRole

audit_logger = logging.getLogger("sentry.audit.user")


@control_silo_endpoint
class UserRolesEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request: Request) -> Response:
        """
        Return a list of `UserRole`'s.
        """
        # XXX(dcramer): we may decide to relax "view" permission over time, but being more restrictive by default
        # is preferred
        if not request.access.has_permission("users.admin"):
            return self.respond(status=403)

        role_list = list(UserRole.objects.all())
        return self.respond(serialize(role_list, user=request.user))

    @sudo_required
    def post(self, request: Request) -> Response:
        """
        Create a new `UserRole`.
        """
        if not request.access.has_permission("users.admin"):
            return self.respond(status=403)

        validator = UserRoleValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.validated_data
        try:
            with transaction.atomic():
                role = UserRole.objects.create(
                    name=result["name"], permissions=result.get("permissions") or []
                )
                audit_logger.info(
                    "user-roles.create",
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

        return self.respond(serialize(role, user=request.user), status=201)
