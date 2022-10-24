from typing import FrozenSet

from django.db import models

from sentry.db.models import FlexibleForeignKey, Model, control_silo_only_model, sane_repr


@control_silo_only_model
class UserPermission(Model):
    """
    Permissions are applied to administrative users and control explicit scope-like permissions within the API.

    Generally speaking, they should only apply to active superuser sessions.
    """

    __include_in_export__ = True

    user = FlexibleForeignKey("sentry.User")
    # permissions should be in the form of 'service-name.permission-name'
    permission = models.CharField(max_length=32)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_userpermission"
        unique_together = (("user", "permission"),)

    __repr__ = sane_repr("user_id", "permission")

    @classmethod
    def for_user(cls, user_id: int) -> FrozenSet[str]:
        """
        Return a set of permission for the given user ID.
        """
        return frozenset(cls.objects.filter(user=user_id).values_list("permission", flat=True))
