from collections.abc import Iterable

from django.db import IntegrityError, transaction
from rest_framework.serializers import ValidationError

from sentry import analytics
from sentry.constants import SentryAppStatus
from sentry.mediators import Mediator, Param
from sentry.models import (
    ApiApplication,
    AuditLogEntryEvent,
    IntegrationFeature,
    SentryApp,
    SentryAppComponent,
    User,
)
from sentry.models.integrations.integration_feature import IntegrationTypes
from sentry.models.integrations.sentry_app import default_uuid, generate_slug

from .mixin import SentryAppMixin


class Creator(Mediator, SentryAppMixin):
    name = Param((str,))
    author = Param((str,))
    organization = Param("sentry.models.Organization")
    scopes = Param(Iterable, default=lambda self: [])
    events = Param(Iterable, default=lambda self: [])
    webhook_url = Param(
        (str,), required=False
    )  # only not required for internal integrations but internalCreator calls this
    redirect_url = Param((str,), required=False)
    is_alertable = Param(bool, default=False)
    verify_install = Param(bool, default=True)
    schema = Param(dict, default=lambda self: {})
    overview = Param((str,), required=False)
    allowed_origins = Param(Iterable, default=lambda self: [])
    popularity = Param(int, required=False)
    request = Param("rest_framework.request.Request", required=False)
    user = Param("sentry.models.User")
    is_internal = Param(bool)

    def call(self):
        self.slug = self._generate_and_validate_slug()
        self.proxy = self._create_proxy_user()
        self.api_app = self._create_api_application()
        self.sentry_app = self._create_sentry_app()
        self._create_ui_components()
        self._create_integration_feature()
        return self.sentry_app

    def _generate_and_validate_slug(self):
        slug = generate_slug(self.name, is_internal=self.is_internal)

        # validate globally unique slug
        queryset = SentryApp.with_deleted.filter(slug=slug)

        if queryset.exists():
            # In reality, the slug is taken but it's determined by the name field
            raise ValidationError(
                {"name": [f"Name {self.name} is already taken, please use another."]}
            )
        return slug

    def _create_proxy_user(self):
        # need a proxy user name that will always be unique
        return User.objects.create(username=f"{self.slug}-{default_uuid()}", is_sentry_app=True)

    def _create_api_application(self):
        return ApiApplication.objects.create(
            owner_id=self.proxy.id, allowed_origins="\n".join(self.allowed_origins)
        )

    def _create_sentry_app(self):
        from sentry.mediators.service_hooks.creator import expand_events

        kwargs = {
            "name": self.name,
            "slug": self.slug,
            "author": self.author,
            "application_id": self.api_app.id,
            "owner_id": self.organization.id,
            "proxy_user_id": self.proxy.id,
            "scope_list": self.scopes,
            "events": expand_events(self.events),
            "schema": self.schema or {},
            "webhook_url": self.webhook_url,
            "redirect_url": self.redirect_url,
            "is_alertable": self.is_alertable,
            "verify_install": self.verify_install,
            "overview": self.overview,
            "popularity": self.popularity or SentryApp._meta.get_field("popularity").default,
            "creator_user": self.user,
            "creator_label": self.user.email
            or self.user.username,  # email is not required for some users (sentry apps)
        }

        if self.is_internal:
            kwargs["status"] = SentryAppStatus.INTERNAL

        return SentryApp.objects.create(**kwargs)

    def _create_ui_components(self):
        schema = self.schema or {}

        for element in schema.get("elements", []):
            SentryAppComponent.objects.create(
                type=element["type"], sentry_app_id=self.sentry_app.id, schema=element
            )

    def _create_integration_feature(self):
        # sentry apps must have at least one feature
        # defaults to 'integrations-api'
        try:
            with transaction.atomic():
                IntegrationFeature.objects.create(
                    target_id=self.sentry_app.id,
                    target_type=IntegrationTypes.SENTRY_APP.value,
                )
        except IntegrityError as e:
            self.log(sentry_app=self.sentry_app.slug, error_message=str(e))

    def audit(self):
        from sentry.utils.audit import create_audit_entry

        if self.request:
            create_audit_entry(
                request=self.request,
                organization=self.organization,
                target_object=self.organization.id,
                event=AuditLogEntryEvent.SENTRY_APP_ADD,
                data={"sentry_app": self.sentry_app.name},
            )

    def record_analytics(self):
        analytics.record(
            "sentry_app.created",
            user_id=self.user.id,
            organization_id=self.organization.id,
            sentry_app=self.sentry_app.slug,
            created_alert_rule_ui_component="alert-rule-action" in self.get_schema_types(),
        )
