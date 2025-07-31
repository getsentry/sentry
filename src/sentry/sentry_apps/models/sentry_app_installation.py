from __future__ import annotations

import uuid
from collections.abc import Collection, Mapping
from typing import TYPE_CHECKING, Any, ClassVar, overload

from django.db import models
from django.utils import timezone
from jsonschema import ValidationError

from sentry.auth.services.auth import AuthenticatedToken
from sentry.backup.scopes import RelocationScope
from sentry.constants import SentryAppInstallationStatus
from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, control_silo_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.db.models.paranoia import ParanoidManager, ParanoidModel
from sentry.hybridcloud.models.outbox import ControlOutboxBase, outbox_context
from sentry.hybridcloud.outbox.base import ReplicatedControlModel
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.projects.services.project import RpcProject
from sentry.sentry_apps.services.app.model import RpcSentryAppComponent, RpcSentryAppInstallation
from sentry.sentry_apps.utils.errors import (
    SentryAppError,
    SentryAppIntegratorError,
    SentryAppSentryError,
)
from sentry.types.region import find_regions_for_orgs

if TYPE_CHECKING:
    from sentry.models.project import Project
    from sentry.sentry_apps.models.sentry_app_component import SentryAppComponent


def default_uuid() -> str:
    return str(uuid.uuid4())


class SentryAppInstallationForProviderManager(ParanoidManager["SentryAppInstallation"]):
    def get_organization_filter_kwargs(self, organization_ids: list[int]):
        return {
            "organization_id__in": organization_ids,
            "status": SentryAppInstallationStatus.INSTALLED,
            "date_deleted": None,
        }

    def get_installed_for_organization(
        self, organization_id: int
    ) -> BaseQuerySet[SentryAppInstallation]:
        return self.filter(**self.get_organization_filter_kwargs([organization_id]))

    def get_by_api_token(self, token_id: int) -> BaseQuerySet[SentryAppInstallation]:
        return self.filter(status=SentryAppInstallationStatus.INSTALLED, api_token_id=token_id)

    def get_projects(self, token: AuthenticatedToken | None) -> BaseQuerySet[Project]:
        from sentry.models.apitoken import is_api_token_auth
        from sentry.models.project import Project

        if token is None or not is_api_token_auth(token) or token.organization_id is None:
            return Project.objects.none()

        return Project.objects.filter(organization_id=token.organization_id)


@control_silo_model
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

    objects: ClassVar[SentryAppInstallationForProviderManager] = (
        SentryAppInstallationForProviderManager()
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryappinstallation"

    # Used when first creating an Installation to tell the serializer that the
    # grant code should be included in the serialization.
    is_new = False

    def save(self, *args, **kwargs):
        self.date_updated = timezone.now()
        return super().save(*args, **kwargs)

    @property
    def api_application_id(self) -> int | None:
        from sentry.sentry_apps.models.sentry_app import SentryApp

        try:
            return self.sentry_app.application_id
        except SentryApp.DoesNotExist:
            return None

    def outbox_region_names(self) -> Collection[str]:
        return find_regions_for_orgs([self.organization_id])

    def outboxes_for_update(self, shard_identifier: int | None = None) -> list[ControlOutboxBase]:
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
        from sentry.hybridcloud.rpc.caching import region_caching_service
        from sentry.sentry_apps.services.app.service import get_installation

        if self.api_token is not None:
            # ApiTokens replicate the organization_id they are associated with.
            with outbox_context(flush=False):
                for ob in self.api_token.outboxes_for_update():
                    ob.save()
        region_caching_service.clear_key(
            key=get_installation.key_from(self.id), region_name=region_name
        )

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

    def payload_for_update(self) -> dict[str, Any] | None:
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
    values: list[Mapping[str, Any]] | None = None,
) -> SentryAppComponent | None:
    from sentry.sentry_apps.models.sentry_app_component import SentryAppComponent

    try:
        component = SentryAppComponent.objects.get(
            sentry_app_id=installation.sentry_app_id, type=component_type
        )
    except SentryAppComponent.DoesNotExist:
        return None

    return prepare_ui_component(installation, component, project_slug, values)


@overload
def prepare_ui_component(
    installation: SentryAppInstallation,
    component: SentryAppComponent,
    project_slug: str | None = None,
    values: list[Mapping[str, Any]] | None = None,
) -> SentryAppComponent | None: ...


@overload
def prepare_ui_component(
    installation: RpcSentryAppInstallation,
    component: RpcSentryAppComponent,
    project_slug: str | None = None,
    values: list[Mapping[str, Any]] | None = None,
) -> RpcSentryAppComponent | None: ...


def prepare_ui_component(
    installation: SentryAppInstallation | RpcSentryAppInstallation,
    component: SentryAppComponent | RpcSentryAppComponent,
    project_slug: str | None = None,
    values: list[Mapping[str, Any]] | None = None,
) -> SentryAppComponent | RpcSentryAppComponent | None:
    from sentry.coreapi import APIError
    from sentry.sentry_apps.components import SentryAppComponentPreparer

    if values is None:
        values = []
    try:
        SentryAppComponentPreparer(
            component=component, install=installation, project_slug=project_slug, values=values
        ).run()
        return component
    except (
        APIError,
        ValidationError,
        SentryAppIntegratorError,
        SentryAppError,
        SentryAppSentryError,
    ):
        # TODO(nisanthan): For now, skip showing the UI Component if the API requests fail
        return None
