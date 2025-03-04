from __future__ import annotations

import dataclasses
from collections.abc import Iterable, Mapping
from dataclasses import field
from itertools import chain
from typing import Any

import sentry_sdk
from django.db import IntegrityError, router, transaction
from django.db.models import Q
from django.http.request import HttpRequest
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from sentry_sdk.api import isolation_scope

from sentry import analytics, audit_log
from sentry.api.helpers.slugs import sentry_slugify
from sentry.auth.staff import has_staff_option
from sentry.constants import SentryAppStatus
from sentry.coreapi import APIError
from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.integrations.models.integration_feature import IntegrationFeature, IntegrationTypes
from sentry.models.apiapplication import ApiApplication
from sentry.models.apiscopes import add_scope_hierarchy
from sentry.models.apitoken import ApiToken
from sentry.sentry_apps.installations import (
    SentryAppInstallationCreator,
    SentryAppInstallationTokenCreator,
)
from sentry.sentry_apps.models.sentry_app import (
    EVENT_EXPANSION,
    REQUIRED_EVENT_PERMISSIONS,
    UUID_CHARS_IN_SLUG,
    SentryApp,
    default_uuid,
)
from sentry.sentry_apps.models.sentry_app_component import SentryAppComponent
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.tasks.sentry_apps import create_or_update_service_hooks_for_sentry_app
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.sentry_apps.service_hook_manager import (
    create_or_update_service_hooks_for_installation,
)

Schema = Mapping[str, Any]


def _get_schema_types(schema: Schema | None) -> set[str]:
    return {element["type"] for element in (schema or {}).get("elements", [])}


def consolidate_events(raw_events: Iterable[str]) -> set[str]:
    """
    Consolidate a list of raw event types ('issue.created', etc) into a list of
    rolled up events ('issue', etc).
    """
    return {
        name
        for (name, rolled_up_events) in EVENT_EXPANSION.items()
        if any(set(raw_events) & set(rolled_up_events))
    }


def expand_events(rolled_up_events: list[str]) -> set[str]:
    """
    Convert a list of rolled up events ('issue', etc) into a list of raw event
    types ('issue.created', etc.)
    """
    return set(
        chain.from_iterable([EVENT_EXPANSION.get(event, [event]) for event in rolled_up_events])
    )


# TODO(schew2381): Delete this method after staff is GA'd and the options are removed
def _is_elevated_user(user) -> bool:
    """
    This is a temporary helper method that checks if the user can become staff
    if staff mode is enabled. Otherwise, it defaults to checking that the user
    can become a superuser.
    """
    return user.is_staff if has_staff_option(user) else user.is_superuser


@dataclasses.dataclass
class SentryAppUpdater:
    sentry_app: SentryApp
    name: str | None = None
    author: str | None = None
    status: str | None = None
    scopes: list[str] | None = None
    events: list[str] | None = None
    webhook_url: str | None = None
    redirect_url: str | None = None
    is_alertable: bool | None = None
    verify_install: bool | None = None
    schema: Schema | None = None
    overview: str | None = None
    allowed_origins: list[str] | None = None
    popularity: int | None = None
    features: list[int] | None = None

    def run(self, user: User | RpcUser) -> SentryApp:
        with transaction.atomic(router.db_for_write(User)):
            self._update_name()
            self._update_author()
            self._update_features(user=user)
            self._update_status(user=user)
            self._update_scopes()
            self._update_events()
            self._update_webhook_url()
            self._update_redirect_url()
            self._update_is_alertable()
            self._update_verify_install()
            self._update_overview()
            self._update_allowed_origins()
            new_schema_elements = self._update_schema()
            self._update_popularity(user=user)
            self.sentry_app.save()
        self._update_service_hooks()
        self.record_analytics(user, new_schema_elements)
        return self.sentry_app

    def _update_features(self, user: User | RpcUser) -> None:
        if self.features is not None:
            if not _is_elevated_user(user) and self.sentry_app.status == SentryAppStatus.PUBLISHED:
                raise APIError("Cannot update features on a published integration.")

            IntegrationFeature.objects.clean_update(
                incoming_features=self.features,
                target=self.sentry_app,
                target_type=IntegrationTypes.SENTRY_APP,
            )

    def _update_name(self) -> None:
        if self.name is not None:
            self.sentry_app.name = self.name

    def _update_author(self) -> None:
        if self.author is not None:
            self.sentry_app.author = self.author

    def _update_status(self, user: User | RpcUser) -> None:
        if self.status is not None:
            if _is_elevated_user(user):
                if self.status == SentryAppStatus.PUBLISHED_STR:
                    self.sentry_app.status = SentryAppStatus.PUBLISHED
                    self.sentry_app.date_published = timezone.now()
                if self.status == SentryAppStatus.UNPUBLISHED_STR:
                    self.sentry_app.status = SentryAppStatus.UNPUBLISHED
            if self.status == SentryAppStatus.PUBLISH_REQUEST_INPROGRESS_STR:
                self.sentry_app.status = SentryAppStatus.PUBLISH_REQUEST_INPROGRESS

    def _update_scopes(self) -> None:
        if self.scopes is not None:
            if self.sentry_app.status == SentryAppStatus.PUBLISHED and set(
                self.sentry_app.scope_list
            ) != set(self.scopes):
                raise APIError("Cannot update permissions on a published integration.")

            # We are using a pre_save signal to enforce scope hierarchy on the ApiToken model.
            # Because we're using bulk_update here to update all the tokens for the SentryApp,
            # we need to manually enforce the hierarchy because the pre_save signal won't be called.
            self.scopes = add_scope_hierarchy(self.scopes)

            self.sentry_app.scope_list = self.scopes

            # update the scopes of active tokens tokens
            tokens = list(
                ApiToken.objects.filter(
                    Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()),
                    application=self.sentry_app.application,
                )
            )
            for token in tokens:
                token.scope_list = self.scopes
            ApiToken.objects.bulk_update(tokens, ["scope_list"])

    def _update_events(self) -> None:
        if self.events is not None:
            for event in self.events:
                needed_scope = REQUIRED_EVENT_PERMISSIONS[event]
                if needed_scope not in self.sentry_app.scope_list:
                    raise APIError(f"{event} webhooks require the {needed_scope} permission.")

            self.sentry_app.events = expand_events(self.events)

    def _update_service_hooks(self) -> None:
        if self.sentry_app.is_published:
            # if it's a published integration, we need to do many updates so we have to do it in a task so we don't time out
            # the client won't know it succeeds but there's not much we can do about that unfortunately
            create_or_update_service_hooks_for_sentry_app.apply_async(
                kwargs={
                    "sentry_app_id": self.sentry_app.id,
                    "webhook_url": self.sentry_app.webhook_url,
                    "events": self.sentry_app.events,
                }
            )
            return

        # for unpublished integrations that aren't installed yet, we may not have an installation
        # if we don't, then won't have any service hooks
        try:
            installation = SentryAppInstallation.objects.get(sentry_app_id=self.sentry_app.id)
        except SentryAppInstallation.DoesNotExist:
            return

        create_or_update_service_hooks_for_installation(
            installation=installation,
            webhook_url=self.sentry_app.webhook_url,
            events=self.sentry_app.events,
        )

    def _update_webhook_url(self) -> None:
        if self.webhook_url is not None:
            self.sentry_app.webhook_url = self.webhook_url

    def _update_redirect_url(self) -> None:
        if self.redirect_url is not None:
            self.sentry_app.redirect_url = self.redirect_url

    def _update_is_alertable(self) -> None:
        if self.is_alertable is not None:
            self.sentry_app.is_alertable = self.is_alertable

    def _update_verify_install(self) -> None:
        if self.verify_install is not None:
            if self.sentry_app.is_internal and self.verify_install:
                raise APIError("Internal integrations cannot have verify_install=True.")
            self.sentry_app.verify_install = self.verify_install

    def _update_overview(self) -> None:
        if self.overview is not None:
            self.sentry_app.overview = self.overview

    def _update_allowed_origins(self) -> None:
        if self.allowed_origins and self.sentry_app.application:
            self.sentry_app.application.allowed_origins = "\n".join(self.allowed_origins)
            self.sentry_app.application.save()

    def _update_popularity(self, user: User | RpcUser) -> None:
        if self.popularity is not None:
            if _is_elevated_user(user):
                self.sentry_app.popularity = self.popularity

    def _update_schema(self) -> set[str] | None:
        if self.schema is not None:
            self.sentry_app.schema = self.schema
            new_schema_elements = self._get_new_schema_elements()
            self._delete_old_ui_components()
            self._create_ui_components()
            return new_schema_elements
        return None

    def _get_new_schema_elements(self) -> set[str]:
        current = SentryAppComponent.objects.filter(sentry_app=self.sentry_app).values_list(
            "type", flat=True
        )
        return _get_schema_types(self.schema) - set(current)

    def _delete_old_ui_components(self) -> None:
        SentryAppComponent.objects.filter(sentry_app_id=self.sentry_app.id).delete()

    def _create_ui_components(self) -> None:
        if self.schema is not None:
            for element in self.schema.get("elements", []):
                SentryAppComponent.objects.create(
                    type=element["type"], sentry_app_id=self.sentry_app.id, schema=element
                )

    def record_analytics(self, user: User | RpcUser, new_schema_elements: set[str] | None) -> None:
        analytics.record(
            "sentry_app.updated",
            user_id=user.id,
            organization_id=self.sentry_app.owner_id,
            sentry_app=self.sentry_app.slug,
            created_alert_rule_ui_component="alert-rule-action" in (new_schema_elements or set()),
        )


@dataclasses.dataclass
class SentryAppCreator:
    name: str
    author: str
    organization_id: int
    is_internal: bool
    scopes: list[str] = dataclasses.field(default_factory=list)
    events: list[str] = dataclasses.field(default_factory=list)
    webhook_url: str | None = None
    redirect_url: str | None = None
    is_alertable: bool = False
    verify_install: bool = True
    schema: Schema = dataclasses.field(default_factory=dict)
    overview: str | None = None
    allowed_origins: list[str] = dataclasses.field(default_factory=list)
    popularity: int | None = None
    metadata: dict | None = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.is_internal:
            assert (
                not self.verify_install
            ), "Internal apps should not require installation verification"

    def run(
        self,
        *,
        user: User | RpcUser,
        request: HttpRequest | None = None,
        skip_default_auth_token: bool = False,
    ) -> SentryApp:
        with transaction.atomic(router.db_for_write(User)), in_test_hide_transaction_boundary():
            slug = self._generate_and_validate_slug()
            proxy = self._create_proxy_user(slug=slug)
            api_app = self._create_api_application(proxy=proxy)
            sentry_app = self._create_sentry_app(user=user, slug=slug, proxy=proxy, api_app=api_app)
            self._create_ui_components(sentry_app=sentry_app)
            self._create_integration_feature(sentry_app=sentry_app)

            if self.is_internal:
                install = self._install(slug=slug, user=user, request=request)
                if not skip_default_auth_token:
                    self._create_access_token(user=user, install=install, request=request)

            self.audit(request=request, sentry_app=sentry_app)
        self.record_analytics(user=user, sentry_app=sentry_app)
        return sentry_app

    def _generate_and_validate_slug(self) -> str:
        # sentry_slugify ensures the slug is not entirely numeric
        slug = sentry_slugify(self.name)
        # for internal, add some uuid to make it unique
        if self.is_internal:
            slug = f"{slug}-{default_uuid()[:UUID_CHARS_IN_SLUG]}"

        # validate globally unique slug
        queryset = SentryApp.with_deleted.filter(slug=slug)

        if queryset.exists():
            # In reality, the slug is taken but it's determined by the name field
            raise ValidationError(
                {"name": [f"Name {self.name} is already taken, please use another."]}
            )

        return slug

    def _create_proxy_user(self, slug: str) -> User:
        # need a proxy user name that will always be unique
        proxy_user = User.objects.create(username=f"{slug}-{default_uuid()}", is_sentry_app=True)
        email = f"{proxy_user.id}@proxy-user.sentry.io"
        proxy_user.update(email=email)
        return proxy_user

    def _create_api_application(self, proxy: User) -> ApiApplication:
        return ApiApplication.objects.create(
            owner_id=proxy.id, allowed_origins="\n".join(self.allowed_origins)
        )

    def _create_sentry_app(
        self, user: User | RpcUser, slug: str, proxy: User, api_app: ApiApplication
    ) -> SentryApp:
        kwargs = {
            "name": self.name,
            "slug": slug,
            "author": self.author,
            "application_id": api_app.id,
            "owner_id": self.organization_id,
            "proxy_user_id": proxy.id,
            "scope_list": self.scopes,
            "events": expand_events(self.events),
            "schema": self.schema or {},
            "webhook_url": self.webhook_url,
            "redirect_url": self.redirect_url,
            "is_alertable": self.is_alertable,
            "verify_install": self.verify_install,
            "overview": self.overview,
            "popularity": self.popularity or SentryApp._meta.get_field("popularity").default,
            "creator_user_id": user.id,
            "creator_label": user.email
            or user.username,  # email is not required for some users (sentry apps)
            "metadata": self.metadata if self.metadata else {},
        }

        if self.is_internal:
            kwargs["status"] = SentryAppStatus.INTERNAL

        return SentryApp.objects.create(**kwargs)

    def _create_ui_components(self, sentry_app: SentryApp) -> None:
        schema = self.schema or {}

        for element in schema.get("elements", []):
            SentryAppComponent.objects.create(
                type=element["type"], sentry_app_id=sentry_app.id, schema=element
            )

    def _create_integration_feature(self, sentry_app: SentryApp) -> None:
        # sentry apps must have at least one feature
        # defaults to 'integrations-api'
        try:
            with transaction.atomic(router.db_for_write(IntegrationFeature)):
                IntegrationFeature.objects.create(
                    target_id=sentry_app.id,
                    target_type=IntegrationTypes.SENTRY_APP.value,
                )
        except IntegrityError:
            with isolation_scope() as scope:
                scope.set_tag("sentry_app", sentry_app.slug)
                sentry_sdk.capture_message("IntegrityError while creating IntegrationFeature")

    def _install(
        self, *, slug: str, user: User | RpcUser, request: HttpRequest | None
    ) -> SentryAppInstallation:
        return SentryAppInstallationCreator(
            organization_id=self.organization_id,
            slug=slug,
            notify=False,
        ).run(user=user, request=request)

    def _create_access_token(
        self, user: User | RpcUser, install: SentryAppInstallation, request: HttpRequest | None
    ) -> None:
        install.api_token = SentryAppInstallationTokenCreator(sentry_app_installation=install).run(
            request=request, user=user
        )
        install.save()

    def audit(self, request: HttpRequest | None, sentry_app: SentryApp) -> None:
        from sentry.utils.audit import create_audit_entry

        if request:
            create_audit_entry(
                request=request,
                organization_id=self.organization_id,
                target_object=self.organization_id,
                event=audit_log.get_event_id("SENTRY_APP_ADD"),
                data={"sentry_app": sentry_app.name},
            )

            if self.is_internal:
                create_audit_entry(
                    request=request,
                    organization_id=self.organization_id,
                    target_object=self.organization_id,
                    event=audit_log.get_event_id("INTERNAL_INTEGRATION_ADD"),
                    data={"name": sentry_app.name},
                )

    def record_analytics(self, user: User | RpcUser, sentry_app: SentryApp) -> None:
        analytics.record(
            "sentry_app.created",
            user_id=user.id,
            organization_id=self.organization_id,
            sentry_app=sentry_app.slug,
            created_alert_rule_ui_component="alert-rule-action" in _get_schema_types(self.schema),
        )

        if self.is_internal:
            analytics.record(
                "internal_integration.created",
                user_id=user.id,
                organization_id=self.organization_id,
                sentry_app=sentry_app.slug,
            )
