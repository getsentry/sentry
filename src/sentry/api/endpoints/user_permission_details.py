from django.db import IntegrityError, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.models import User, UserPermission


class UserPermissionDetailsEndpoint(UserEndpoint):
    def get(self, request: Request, user: User, permission_name: str) -> Response:
        has_perm = UserPermission.objects.filter(user=user, permission=permission_name).exists()
        return self.respond(status=204 if has_perm else 404)

    def post(self, request: Request, user: User, permission_name: str) -> Response:
        if not request.access.has_permission("users.admin"):
            return self.respond(status=403)

        try:
            with transaction.atomic():
                UserPermission.objects.create(user=user, permission=permission_name)
        except IntegrityError as e:
            if "already exists" in str(e):
                return self.respond(status=410)
            raise
        return self.respond(status=201)

    def delete(self, request: Request, user: User, permission_name: str) -> Response:
        if not request.access.has_permission("users.admin"):
            return self.respond(status=403)

        deleted, _ = UserPermission.objects.filter(user=user, permission=permission_name).delete()
        if deleted:
            return self.respond(status=204)
        return self.respond(status=404)
