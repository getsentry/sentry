from typing import FrozenSet

from django.db import models

from sentry.db.models import ArrayField, DefaultFieldsModel, sane_repr
from sentry.db.models.fields.foreignkey import FlexibleForeignKey


class UserRole(DefaultFieldsModel):
    """
    Roles are applied to administrative users and apply a set of `UserPermission`.
    """

    __include_in_export__ = True

    name = models.CharField(max_length=32, unique=True)
    permissions = ArrayField()
    users = models.ManyToManyField("sentry.User", through="sentry.UserRoleUser")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_userrole"

    __repr__ = sane_repr("name", "permissions")

    @classmethod
    def permissions_for_user(cls, user_id: int) -> FrozenSet[str]:
        """
        Return a set of permission for the given user ID scoped to roles.
        """
        return frozenset(
            i
            for sl in cls.objects.filter(users=user_id).values_list("permissions", flat=True)
            for i in sl
        )


class UserRoleUser(DefaultFieldsModel):
    __include_in_export__ = True

    user = FlexibleForeignKey("sentry.User")
    role = FlexibleForeignKey("sentry.UserRole")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_userrole_users"

    __repr__ = sane_repr("user", "role")
