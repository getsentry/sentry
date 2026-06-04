from __future__ import annotations

from urllib.parse import urljoin

from django.db import models
from django.urls import reverse

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, control_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.organizationmapping import OrganizationMapping
from sentry.types.cell import get_locality_name_for_cell


@control_silo_model
class OrganizationAvatarReplica(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="CASCADE", unique=True)
    avatar_type = models.PositiveSmallIntegerField(default=0)
    avatar_ident = models.CharField(max_length=32)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationavatarreplica"

    __repr__ = sane_repr("organization_id", "avatar_type")

    def absolute_url(self) -> str:
        """
        Provide a consistent interface with OrganizationAvatar to simplify serializers.
        """
        from sentry.api.utils import generate_locality_url

        mapping = OrganizationMapping.objects.get_from_cache(organization_id=self.organization_id)
        locality_url = generate_locality_url(get_locality_name_for_cell(mapping.cell_name))
        path = reverse("sentry-organization-avatar-url", args=[mapping.slug, self.avatar_ident])
        return urljoin(locality_url, path)
