from django.db import models

from sentry.db.models import FlexibleForeignKey, Model, sane_repr


class UserPermission(Model):
    __core__ = True

    user = FlexibleForeignKey("sentry.User")
    # permissions should be in the form of 'service-name.permission-name'
    permission = models.CharField(max_length=32)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_userpermission"
        unique_together = (("user", "permission"),)

    __repr__ = sane_repr("user_id", "permission")

    @classmethod
    def for_user(cls, user_id):
        return frozenset(cls.objects.filter(user=user_id).values_list("permission", flat=True))
