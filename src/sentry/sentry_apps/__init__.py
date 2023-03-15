from __future__ import annotations

import dataclasses
from typing import Any, List, Mapping, Set

import sentry_sdk
from django.db import IntegrityError, transaction
from rest_framework.request import Request
from rest_framework.serializers import ValidationError
from sentry_sdk.api import push_scope

from sentry import analytics, audit_log
from sentry.constants import SentryAppStatus
from sentry.mediators import sentry_app_installation_tokens, sentry_app_installations
from sentry.models import (
    ApiApplication,
    IntegrationFeature,
    SentryApp,
    SentryAppComponent,
    SentryAppInstallation,
    User,
)
from sentry.models.integrations.integration_feature import IntegrationTypes
from sentry.models.integrations.sentry_app import default_uuid, generate_slug

Schema = Mapping[str, Any]


def _get_schema_types(schema: Schema) -> Set[str]:
    return {element["type"] for element in (schema or {}).get("elements", [])}


@dataclasses.dataclass
class SentryAppCreator:
    name: str
    author: str
    organization_id: int
    is_internal: bool
    scopes: List[str] = dataclasses.field(default_factory=list)
    events: List[str] = dataclasses.field(default_factory=list)
    webhook_url: str | None = None
    redirect_url: str | None = None
    is_alertable: bool = False
    verify_install: bool = True
    schema: Schema = dataclasses.field(default_factory=dict)
    overview: str | None = None
    allowed_origins: List[str] = dataclasses.field(default_factory=list)
    popularity: int | None = None

    def __post_init__(self):
        # TODO:
        # Maybe set organization name as default author
        assert not self.verify_install, "Internal apps should not require installation verification"

    def run(self, *, user: User, request: Request | None = None) -> SentryApp:
        with transaction.atomic():
            slug = self._generate_and_validate_slug()
            proxy = self._create_proxy_user(slug=slug)
            api_app = self._create_api_application(proxy=proxy)
            sentry_app = self._create_sentry_app(user=user, slug=slug, proxy=proxy, api_app=api_app)
            self._create_ui_components(sentry_app=sentry_app)
            self._create_integration_feature(sentry_app=sentry_app)

            if self.is_internal:
                install = self._install()
                self._create_access_token(user=user, install=install, request=request)

            self.audit(request=request, sentry_app=sentry_app)
        self.record_analytics(user=user, sentry_app=sentry_app)
        return sentry_app

    def _generate_and_validate_slug(self) -> str:
        slug = generate_slug(self.name, is_internal=self.is_internal)

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
        return User.objects.create(username=f"{slug}-{default_uuid()}", is_sentry_app=True)

    def _create_api_application(self, proxy: User) -> ApiApplication:
        return ApiApplication.objects.create(
            owner_id=proxy.id, allowed_origins="\n".join(self.allowed_origins)
        )

    def _create_sentry_app(
        self, user: User, slug: str, proxy: User, api_app: ApiApplication
    ) -> SentryApp:
        from sentry.mediators.service_hooks.creator import expand_events

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
            "creator_user": user,
            "creator_label": user.email
            or user.username,  # email is not required for some users (sentry apps)
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
            with transaction.atomic():
                IntegrationFeature.objects.create(
                    target_id=sentry_app.id,
                    target_type=IntegrationTypes.SENTRY_APP.value,
                )
        except IntegrityError:
            with push_scope() as scope:
                scope.set_tag("sentry_app", sentry_app.slug)
                sentry_sdk.capture_message("IntegrityError while creating IntegrationFeature")

    def _install(self) -> SentryAppInstallation:
        return sentry_app_installations.Creator.run(
            organization=self.organization,
            slug=self.sentry_app.slug,
            user=self.user,
            request=self.request,
            notify=False,
        )

    def _create_access_token(
        self, user: User, install: SentryAppInstallation, request: Request
    ) -> None:
        install.api_token = sentry_app_installation_tokens.Creator.run(
            request=request, sentry_app_installation=install, user=user
        )
        install.save()

    def audit(self, request: Request | None, sentry_app: SentryApp) -> None:
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

    def record_analytics(self, user: User, sentry_app: SentryApp):
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
