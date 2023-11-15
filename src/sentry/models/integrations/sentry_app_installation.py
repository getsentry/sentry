from __future__ import annotations

import uuid
from itertools import chain
from typing import TYPE_CHECKING, Any, ClassVar, Collection, List, Mapping

from django.db import models
from django.db.models import OuterRef, QuerySet, Subquery
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.constants import SentryAppInstallationStatus
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    ParanoidManager,
    ParanoidModel,
    control_silo_only_model,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.outboxes import ReplicatedControlModel
from sentry.services.hybrid_cloud.auth import AuthenticatedToken
from sentry.services.hybrid_cloud.project import RpcProject
from sentry.types.region import find_regions_for_orgs

if TYPE_CHECKING:
    from sentry.models.apitoken import ApiToken
    from sentry.models.integrations.sentry_app_component import SentryAppComponent
    from sentry.models.project import Project

from sentry.models.outbox import ControlOutboxBase, OutboxCategory, outbox_context


def default_uuid():
    return str(uuid.uuid4())


class SentryAppInstallationForProviderManager(ParanoidManager["SentryAppInstallation"]):
    def get_organization_filter_kwargs(self, organization_ids: List[int]):
        return {
            "organization_id__in": organization_ids,
            "status": SentryAppInstallationStatus.INSTALLED,
            "date_deleted": None,
        }

    def get_installed_for_organization(self, organization_id: int) -> QuerySet:
        return self.filter(**self.get_organization_filter_kwargs([organization_id]))

    def get_by_api_token(self, token_id: int) -> QuerySet:
        return self.filter(status=SentryAppInstallationStatus.INSTALLED, api_token_id=token_id)

    def get_projects(self, token: ApiToken | AuthenticatedToken) -> QuerySet[Project]:
        from sentry.models.apitoken import is_api_token_auth
        from sentry.models.project import Project

        if not is_api_token_auth(token) or token.organization_id is None:
            return Project.objects.none()

        return Project.objects.filter(organization_id=token.organization_id)

    def get_related_sentry_app_components(
        self,
        organization_ids: List[int],
        sentry_app_ids: List[int],
        type: str,
        group_by="sentry_app_id",
    ):
        from sentry.models.integrations.sentry_app_component import SentryAppComponent

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
class SentryAppInstallation(ReplicatedControlModel, ParanoidModel):
    __relocation_scope__ = RelocationScope.Global
    category = OutboxCategory.SENTRY_APP_INSTALLATION_UPDATE

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

    objects: ClassVar[
        SentryAppInstallationForProviderManager
    ] = SentryAppInstallationForProviderManager()

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

    @property
    def api_application_id(self) -> int | None:
        from sentry.models.integrations.sentry_app import SentryApp

        try:
            return self.sentry_app.application_id
        except SentryApp.DoesNotExist:
            return None

    def outbox_region_names(self) -> Collection[str]:
        return find_regions_for_orgs([self.organization_id])

    def outboxes_for_update(self, shard_identifier: int | None = None) -> List[ControlOutboxBase]:
        # Use 0 in case of bad relations from api_applicaiton_id -- the replication ordering for
        # these isn't so important in that case.
        return super().outboxes_for_update(shard_identifier=self.api_application_id or 0)

    def prepare_ui_component(
        self,
        component: SentryAppComponent,
        project: Project | RpcProject | None = None,
        values: Any = None,
    ) -> SentryAppComponent | None:
        return prepare_ui_component(
            self, component, project_slug=project.slug if project else None, values=values
        )

    def handle_async_replication(self, region_name: str, shard_identifier: int) -> None:
        if self.api_token is not None:
            # ApiTokens replicate the organization_id they are associated with.
            with outbox_context(flush=False):
                for ob in self.api_token.outboxes_for_update():
                    ob.save()

    @classmethod
    def handle_async_deletion(
        cls,
        identifier: int,
        region_name: str,
        shard_identifier: int,
        payload: Mapping[str, Any] | None,
    ) -> None:
        from sentry.models.apitoken import ApiToken

        if payload:
            api_token_id = payload.get("api_token_id", None)
            user_id = payload.get("user_id", None)
            if isinstance(api_token_id, int) and isinstance(user_id, int):
                with outbox_context(flush=False):
                    for ob in ApiToken(id=api_token_id, user_id=user_id).outboxes_for_update():
                        ob.save()

    def payload_for_update(self) -> Mapping[str, Any] | None:
        from sentry.models.apitoken import ApiToken

        try:
            return dict(
                api_token_id=self.api_token_id,
                user_id=self.api_token.user_id if self.api_token else None,
            )
        except ApiToken.DoesNotExist:
            return None


def prepare_sentry_app_components(
    installation: SentryAppInstallation,
    component_type: str,
    project_slug: str | None = None,
    values: List[Mapping[str, Any]] | None = None,
) -> SentryAppComponent | None:
    from sentry.models.integrations.sentry_app_component import SentryAppComponent

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
    values: List[Mapping[str, Any]] | None = None,
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
