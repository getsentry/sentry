from __future__ import annotations

import uuid
from itertools import chain
from typing import TYPE_CHECKING, Any, List

from django.db import models, transaction
from django.db.models import OuterRef, QuerySet, Subquery
from django.utils import timezone

from sentry.constants import SentryAppInstallationStatus, SentryAppStatus
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    ParanoidManager,
    ParanoidModel,
    control_silo_only_model,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.postgres.roles import in_test_psql_role_override
from sentry.types.region import find_regions_for_orgs

if TYPE_CHECKING:
    from sentry.models import ApiToken, Project, SentryAppComponent

from sentry.models.outbox import ControlOutbox, OutboxCategory, OutboxScope


def default_uuid():
    return str(uuid.uuid4())


class SentryAppInstallationForProviderManager(ParanoidManager):
    def get_organization_filter_kwargs(self, organization_ids: List[int]):
        return {
            "organization_id__in": organization_ids,
            "status": SentryAppInstallationStatus.INSTALLED,
            "date_deleted": None,
        }

    def get_installed_for_organization(self, organization_id: int) -> QuerySet:
        return self.filter(**self.get_organization_filter_kwargs([organization_id]))

    def get_by_api_token(self, token_id: str) -> QuerySet:
        return self.filter(status=SentryAppInstallationStatus.INSTALLED, api_token_id=token_id)

    def get_projects(self, token: ApiToken) -> QuerySet[Project]:
        from sentry.models import Project, SentryAppInstallationToken

        try:
            installation = self.get_by_api_token(token.id).get()
        except SentryAppInstallation.DoesNotExist:
            installation = None

        if not installation:
            return Project.objects.none()

        # TODO(nisanthan): Right now, Internal Integrations can have multiple ApiToken, so we use the join table `SentryAppInstallationToken` to map the one to many relationship. However, for Public Integrations, we can only have 1 ApiToken per installation. So we currently don't use the join table for Public Integrations. We should update to make records in the join table for Public Integrations so that we can have a common abstraction for finding an installation by ApiToken.
        if installation.sentry_app.status == SentryAppStatus.INTERNAL:
            return SentryAppInstallationToken.objects.get_projects(token)

        return Project.objects.filter(organization_id=installation.organization_id)

    def get_related_sentry_app_components(
        self,
        organization_ids: List[int],
        sentry_app_ids: List[int],
        type: str,
        group_by="sentry_app_id",
    ):
        from sentry.models import SentryAppComponent

        component_query = SentryAppComponent.objects.filter(
            sentry_app_id=OuterRef("sentry_app_id"), type=type
        )

        sentry_app_installations = (
            self.filter(**self.get_organization_filter_kwargs(organization_ids))
            .filter(sentry_app_id__in=sentry_app_ids)
            .annotate(
                # Cannot annotate model object only individual fields. We can convert it into SentryAppComponent instance later.
                sentry_app_component_id=Subquery(component_query.values("id")[:1]),
                sentry_app_component_schema=Subquery(component_query.values("schema")[:1]),
                sentry_app_component_uuid=Subquery(component_query.values("uuid")[:1]),
            )
            .filter(sentry_app_component_id__isnull=False)
        )

        # There should only be 1 install of a SentryApp per organization
        grouped_sentry_app_installations = {
            getattr(install, group_by): {
                "sentry_app_installation": install.to_dict(),
                "sentry_app_component": {
                    "id": install.sentry_app_component_id,
                    "type": type,
                    "schema": install.sentry_app_component_schema,
                    "uuid": install.sentry_app_component_uuid,
                    "sentry_app_id": install.sentry_app_id,
                },
            }
            for install in sentry_app_installations
        }

        return grouped_sentry_app_installations


@control_silo_only_model
class SentryAppInstallation(ParanoidModel):
    __include_in_export__ = True

    sentry_app = FlexibleForeignKey("sentry.SentryApp", related_name="installations")

    # SentryApp's are installed and scoped to an Organization. They will have
    # access, defined by their scopes, to Teams, Projects, etc. under that
    # Organization, implicitly.
    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="CASCADE")

    # Each installation has a Grant that the integration can exchange for an
    # Access Token.
    api_grant = models.OneToOneField(
        "sentry.ApiGrant",
        null=True,
        on_delete=models.SET_NULL,
        related_name="sentry_app_installation",
    )

    # Only use this token for public integrations since each install has only token at a time
    # An installation gets an access token once the Grant has been exchanged,
    # and is updated when the token gets refreshed.
    #
    # Do NOT Use this token for internal integrations since there could be multiple
    # need to look at SentryAppInstallationToken which connects api_tokens to installations
    api_token = models.OneToOneField(
        "sentry.ApiToken",
        null=True,
        on_delete=models.SET_NULL,
        related_name="sentry_app_installation",
    )

    uuid = models.CharField(max_length=64, default=default_uuid)

    status = BoundedPositiveIntegerField(
        default=SentryAppInstallationStatus.PENDING,
        choices=SentryAppInstallationStatus.as_choices(),
        db_index=True,
    )

    date_added = models.DateTimeField(default=timezone.now)
    date_updated = models.DateTimeField(default=timezone.now)

    objects = SentryAppInstallationForProviderManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryappinstallation"

    # Used when first creating an Installation to tell the serializer that the
    # grant code should be included in the serialization.
    is_new = False

    def to_dict(self):
        opts = self._meta
        data = {}
        for field in chain(opts.concrete_fields, opts.private_fields, opts.many_to_many):
            field_name = field.get_attname()
            data[field_name] = self.serializable_value(field_name)
        return data

    def save(self, *args, **kwargs):
        self.date_updated = timezone.now()
        return super().save(*args, **kwargs)

    def delete(self, **kwargs):
        with transaction.atomic(), in_test_psql_role_override("postgres"):
            for outbox in self.outboxes_for_update(
                identifier=self.id,
                org_id=self.organization_id,
                api_application_id=self.api_application_id,
            ):
                outbox.save()
            return super().delete(**kwargs)

    @property
    def api_application_id(self) -> int:
        from sentry.models import SentryApp

        try:
            return self.sentry_app.application_id
        except SentryApp.DoesNotExist:
            # In the case of a bad relation, it's ok to just replicate this in a special ordering.
            return 0

    @classmethod
    def outboxes_for_update(
        cls, identifier: int, org_id: int, api_application_id: int
    ) -> List[ControlOutbox]:
        return [
            ControlOutbox(
                shard_scope=OutboxScope.APP_SCOPE,
                shard_identifier=api_application_id,
                object_identifier=identifier,
                category=OutboxCategory.SENTRY_APP_INSTALLATION_UPDATE,
                region_name=region_name,
            )
            for region_name in find_regions_for_orgs([org_id])
        ]

    def prepare_sentry_app_components(self, component_type, project=None, values=None):
        from sentry.models import SentryAppComponent

        try:
            component = SentryAppComponent.objects.get(
                sentry_app_id=self.sentry_app_id, type=component_type
            )
        except SentryAppComponent.DoesNotExist:
            return None

        return self.prepare_ui_component(component, project, values)

    def prepare_ui_component(self, component, project=None, values=None):
        return prepare_ui_component(
            self, component, project_slug=project.slug if project else None, values=values
        )


def prepare_sentry_app_components(
    installation: SentryAppInstallation,
    component_type: str,
    project_slug: str | None = None,
    values: Any = None,
):
    from sentry.models import SentryAppComponent

    try:
        component = SentryAppComponent.objects.get(
            sentry_app_id=installation.sentry_app_id, type=component_type
        )
    except SentryAppComponent.DoesNotExist:
        return None

    return prepare_ui_component(installation, component, project_slug, values)


def prepare_ui_component(
    installation: SentryAppInstallation,
    component: SentryAppComponent,
    project_slug: str | None = None,
    values: Any = None,
) -> SentryAppComponent | None:
    from sentry.coreapi import APIError
    from sentry.sentry_apps.components import SentryAppComponentPreparer

    if values is None:
        values = []
    try:
        SentryAppComponentPreparer(
            component=component, install=installation, project_slug=project_slug, values=values
        ).run()
        return component
    except APIError:
        # TODO(nisanthan): For now, skip showing the UI Component if the API requests fail
        return None
