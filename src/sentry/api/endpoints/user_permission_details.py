from django.db import IntegrityError, transaction

from sentry.api.bases.user import UserEndpoint
from sentry.auth.superuser import has_superuser_permission
from sentry.models import UserPermission


class UserPermissionDetailsEndpoint(UserEndpoint):
    def get(self, request, user, permission_name):
        has_perm = UserPermission.objects.filter(user=user, permission=permission_name).exists()
        return self.respond(status=204 if has_perm else 404)

    def post(self, request, user, permission_name):
        if not has_superuser_permission(request, "users.admin"):
            return self.respond(status=403)

        try:
            with transaction.atomic():
                UserPermission.objects.create(user=user, permission=permission_name)
        except IntegrityError as e:
            if "already exists" in str(e):
                return self.respond(status=410)
            raise
        return self.respond(status=201)

    def delete(self, request, user, permission_name):
        if not has_superuser_permission(request, "users.admin"):
            return self.respond(status=403)

        deleted, _ = UserPermission.objects.filter(user=user, permission=permission_name).delete()
        if deleted:
            return self.respond(status=204)
        return self.respond(status=404)
