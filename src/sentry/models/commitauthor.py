from __future__ import absolute_import, print_function

from django.db import models

from sentry.db.models import BoundedPositiveIntegerField, Model, sane_repr


class CommitAuthor(Model):
    __core__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    name = models.CharField(max_length=128, null=True)
    email = models.EmailField(max_length=75)
    external_id = models.CharField(max_length=164, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_commitauthor"
        unique_together = (("organization_id", "email"), ("organization_id", "external_id"))

    __repr__ = sane_repr("organization_id", "email", "name")

    def find_users(self):
        from sentry.models import User

        return User.objects.filter(
            emails__email__iexact=self.email,
            emails__is_verified=True,
            sentry_orgmember_set__organization=self.organization_id,
            is_active=True,
        )
