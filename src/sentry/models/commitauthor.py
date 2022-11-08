from typing import TYPE_CHECKING, List

from django.db import models

from sentry.db.models import BoundedBigIntegerField, Model, region_silo_only_model, sane_repr
from sentry.db.models.manager import BaseManager
from sentry.models.organizationmember import OrganizationMember

if TYPE_CHECKING:
    from sentry.services.hybrid_cloud.user import APIUser


class CommitAuthorManager(BaseManager):
    def get_or_create(self, organization_id, email, defaults, **kwargs):
        # Force email address to lowercase because many providers do this. Note though that this isn't technically
        # to spec; only the domain part of the email address is actually case-insensitive.
        # See: https://stackoverflow.com/questions/9807909/are-email-addresses-case-sensitive
        return super().get_or_create(
            organization_id=organization_id, email=email.lower(), defaults=defaults, **kwargs
        )


@region_silo_only_model
class CommitAuthor(Model):
    __include_in_export__ = False

    organization_id = BoundedBigIntegerField(db_index=True)
    name = models.CharField(max_length=128, null=True)
    email = models.CharField(max_length=200)
    external_id = models.CharField(max_length=164, null=True)

    objects = CommitAuthorManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_commitauthor"
        unique_together = (("organization_id", "email"), ("organization_id", "external_id"))

    __repr__ = sane_repr("organization_id", "email", "name")

    def find_users(self) -> List["APIUser"]:
        from sentry.services.hybrid_cloud.user import user_service

        users = user_service.get_many_by_email(self.email)
        group_memberships = OrganizationMember.objects.filter(
            organization_id=self.organization_id,
        ).values_list("user_id", flat=True)
        return list(filter(lambda u: u.id in group_memberships, users))
