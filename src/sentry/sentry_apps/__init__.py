from __future__ import annotations

import dataclasses
import datetime
from functools import cached_property
from itertools import chain
from typing import Any, Iterable, List, Mapping, MutableMapping, Set
from urllib.parse import urlparse, urlunparse

import sentry_sdk
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.encoding import force_str
from django.utils.http import urlencode
from rest_framework.request import Request
from rest_framework.serializers import ValidationError
from sentry_sdk.api import push_scope

from sentry import analytics, audit_log
from sentry.constants import (
    INTERNAL_INTEGRATION_TOKEN_COUNT_MAX,
    SentryAppInstallationStatus,
    SentryAppStatus,
)
from sentry.coreapi import APIError
from sentry.exceptions import ApiTokenLimitError
from sentry.mediators.external_requests import SelectRequester
from sentry.models import (
    ApiApplication,
    ApiGrant,
    ApiToken,
    IntegrationFeature,
    Organization,
    SentryApp,
    SentryAppComponent,
    SentryAppInstallation,
    SentryAppInstallationToken,
    User,
)
from sentry.models.integrations.integration_feature import IntegrationTypes
from sentry.models.integrations.sentry_app import (
    EVENT_EXPANSION,
    REQUIRED_EVENT_PERMISSIONS,
    default_uuid,
    generate_slug,
)
from sentry.services.hybrid_cloud.hook import hook_service
from sentry.tasks.sentry_apps import installation_webhook
from sentry.utils import json

Schema = Mapping[str, Any]


def _get_schema_types(schema: Schema | None) -> Set[str]:
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

    def __post_init__(self) -> None:
        if self.is_internal:
            assert (
                not self.verify_install
            ), "Internal apps should not require installation verification"

    def run(self, *, user: User, request: Request | None = None) -> SentryApp:
        with transaction.atomic():
            slug = self._generate_and_validate_slug()
            proxy = self._create_proxy_user(slug=slug)
            api_app = self._create_api_application(proxy=proxy)
            sentry_app = self._create_sentry_app(user=user, slug=slug, proxy=proxy, api_app=api_app)
            self._create_ui_components(sentry_app=sentry_app)
            self._create_integration_feature(sentry_app=sentry_app)

            if self.is_internal:
                install = self._install(slug=slug, user=user, request=request)
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

        return slug  # type: ignore

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

    def _install(self, *, slug: str, user: User, request: Request | None) -> SentryAppInstallation:
        return SentryAppInstallationCreator(
            organization_id=self.organization_id,
            slug=slug,
            notify=False,
        ).run(user=user, request=request)

    def _create_access_token(
        self, user: User, install: SentryAppInstallation, request: Request
    ) -> None:
        install.api_token = SentryAppInstallationTokenCreator(sentry_app_installation=install).run(
            request=request, user=user
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

    def record_analytics(self, user: User, sentry_app: SentryApp) -> None:
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


@dataclasses.dataclass
class SentryAppInstallationCreator:
    organization_id: int
    slug: str
    notify: bool = True

    def run(self, *, user: User, request: Request | None) -> SentryAppInstallation:
        with transaction.atomic():
            api_grant = self._create_api_grant()
            install = self._create_install(api_grant=api_grant)
            self._create_service_hooks(install=install)
            install.is_new = True
            self.audit(request=request)

        if self.notify:
            installation_webhook.delay(install.id, user.id)

        self.record_analytics(user=user)
        return install

    def _create_install(self, api_grant: ApiGrant) -> SentryAppInstallation:
        status = SentryAppInstallationStatus.PENDING
        if not self.sentry_app.verify_install:
            status = SentryAppInstallationStatus.INSTALLED

        return SentryAppInstallation.objects.create(
            organization_id=self.organization_id,
            sentry_app_id=self.sentry_app.id,
            api_grant_id=api_grant.id,
            status=status,
        )

    def _create_api_grant(self) -> ApiGrant:
        return ApiGrant.objects.create(
            user_id=self.sentry_app.proxy_user.id, application_id=self.api_application.id
        )

    def _create_service_hooks(self, install: SentryAppInstallation) -> None:
        # only make the service hook if there is a webhook url
        if self.sentry_app.webhook_url:
            hook_service.create_service_hook(
                application_id=self.api_application.id,
                actor_id=install.id,
                installation_id=install.id,
                organization_id=self.organization_id,
                events=self.sentry_app.events,
                url=self.sentry_app.webhook_url,
            )

    def audit(self, request: Request | None) -> None:
        from sentry.utils.audit import create_audit_entry

        if request:
            create_audit_entry(
                request=request,
                organization_id=self.organization_id,
                target_object=self.organization_id,
                event=audit_log.get_event_id("SENTRY_APP_INSTALL"),
                data={"sentry_app": self.sentry_app.name},
            )

    def record_analytics(self, user: User) -> None:
        analytics.record(
            "sentry_app.installed",
            user_id=user.id,
            organization_id=self.organization_id,
            sentry_app=self.slug,
        )

    @cached_property
    def api_application(self) -> ApiApplication:
        return self.sentry_app.application

    @cached_property
    def sentry_app(self) -> SentryApp:
        return SentryApp.objects.get(slug=self.slug)


@dataclasses.dataclass
class SentryAppInstallationTokenCreator:
    sentry_app_installation: SentryAppInstallation
    expires_at: datetime.date | None = None
    generate_audit: bool = False

    def run(self, user: User, request: Request | None = None) -> ApiToken:
        with transaction.atomic():
            self._check_token_limit()
            api_token = self._create_api_token()
            self._create_sentry_app_installation_token(api_token=api_token)
            self.audit(request, api_token)
        self.record_analytics(user)
        return api_token

    def _check_token_limit(self) -> None:
        curr_count = SentryAppInstallationToken.objects.filter(
            sentry_app_installation=self.sentry_app_installation
        ).count()
        if curr_count >= INTERNAL_INTEGRATION_TOKEN_COUNT_MAX:
            raise ApiTokenLimitError(
                "Cannot generate more than %d tokens for a single integration"
                % INTERNAL_INTEGRATION_TOKEN_COUNT_MAX
            )

    def _create_api_token(self) -> ApiToken:
        return ApiToken.objects.create(
            user=self.sentry_app.proxy_user,
            application_id=self.sentry_app.application.id,
            scope_list=self.sentry_app.scope_list,
            expires_at=self.expires_at,
        )

    def _create_sentry_app_installation_token(
        self, api_token: ApiToken
    ) -> SentryAppInstallationToken:
        return SentryAppInstallationToken.objects.create(
            api_token=api_token, sentry_app_installation=self.sentry_app_installation
        )

    def audit(self, request: Request | None, api_token: ApiToken) -> None:
        from sentry.utils.audit import create_audit_entry

        if request and self.generate_audit:
            create_audit_entry(
                request=request,
                organization=self.organization,
                target_object=api_token.id,
                event=audit_log.get_event_id("INTERNAL_INTEGRATION_ADD_TOKEN"),
                data={"sentry_app": self.sentry_app.name},
            )

    def record_analytics(self, user: User) -> None:
        from sentry import analytics

        analytics.record(
            "sentry_app_installation_token.created",
            user_id=user.id,
            organization_id=self.organization.id,
            sentry_app_installation_id=self.sentry_app_installation.id,
            sentry_app=self.sentry_app.slug,
        )

    @cached_property
    def sentry_app(self) -> SentryApp:
        return self.sentry_app_installation.sentry_app

    @cached_property
    def organization(self) -> Organization:
        return self.sentry_app_installation.organization


@dataclasses.dataclass
class SentryAppUpdater:
    sentry_app: SentryApp
    name: str | None = None
    author: str | None = None
    status: str | None = None
    scopes: List[str] | None = None
    events: List[str] | None = None
    webhook_url: str | None = None
    redirect_url: str | None = None
    is_alertable: bool | None = None
    verify_install: bool | None = None
    schema: Schema | None = None
    overview: str | None = None
    allowed_origins: List[str] | None = None
    popularity: int | None = None
    features: List[str] | None = None
    # user = Param("sentry.models.User")

    def run(self, user: User) -> SentryApp:
        with transaction.atomic():
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
            self._update_service_hooks()
            self._update_popularity(user=user)
            self.sentry_app.save()
        self.record_analytics(user, new_schema_elements)
        return self.sentry_app

    def _update_features(self, user: User) -> None:
        if self.features is not None:
            if not user.is_superuser and self.sentry_app.status == SentryAppStatus.PUBLISHED:
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

    def _update_status(self, user: User) -> None:
        if self.status is not None:
            if user.is_superuser:
                if self.status == SentryAppStatus.PUBLISHED_STR:
                    self.sentry_app.status = SentryAppStatus.PUBLISHED
                    self.sentry_app.date_published = timezone.now()
                if self.status == SentryAppStatus.UNPUBLISHED_STR:
                    self.sentry_app.status = SentryAppStatus.UNPUBLISHED
            if self.status == SentryAppStatus.PUBLISH_REQUEST_INPROGRESS_STR:
                self.sentry_app.status = SentryAppStatus.PUBLISH_REQUEST_INPROGRESS

    def _update_scopes(self) -> None:
        if self.scopes is not None:
            if (
                self.sentry_app.status == SentryAppStatus.PUBLISHED
                and self.sentry_app.scope_list != self.scopes
            ):
                raise APIError("Cannot update permissions on a published integration.")
            self.sentry_app.scope_list = self.scopes
            # update the scopes of active tokens tokens
            ApiToken.objects.filter(
                Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()),
                application=self.sentry_app.application,
            ).update(scope_list=list(self.scopes))

    def _update_events(self) -> None:
        if self.events is not None:
            for event in self.events:
                needed_scope = REQUIRED_EVENT_PERMISSIONS[event]
                if needed_scope not in self.sentry_app.scope_list:
                    raise APIError(f"{event} webhooks require the {needed_scope} permission.")

            self.sentry_app.events = expand_events(self.events)

    def _update_service_hooks(self) -> None:
        hooks = hook_service.update_webhook_and_events(
            application_id=self.sentry_app.application_id,
            webhook_url=self.sentry_app.webhook_url,
            events=self.sentry_app.events,
        )

        # if we don't have hooks but we have a webhook url now, need to create it for an internal integration
        if self.sentry_app.webhook_url and self.sentry_app.is_internal and not hooks:
            installation = SentryAppInstallation.objects.get(sentry_app_id=self.sentry_app.id)
            # Note that because the update transaction is disjoint with this transaction, it is still
            # possible we redundantly create service hooks in the face of two concurrent requests.
            # If this proves a problem, we would need to add an additional semantic, "only create if does not exist".
            # But I think, it should be fine.
            hook_service.create_service_hook(
                application_id=self.sentry_app.application_id,
                actor_id=installation.id,
                installation_id=installation.id,
                organization_id=self.sentry_app.owner_id,
                project_ids=[],
                events=self.sentry_app.events,
                url=self.sentry_app.webhook_url,
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
        if self.allowed_origins is not None:
            self.sentry_app.application.allowed_origins = "\n".join(self.allowed_origins)
            self.sentry_app.application.save()

    def _update_popularity(self, user: User) -> None:
        if self.popularity is not None:
            if user.is_superuser:
                self.sentry_app.popularity = self.popularity

    def _update_schema(self) -> Set[str] | None:
        if self.schema is not None:
            self.sentry_app.schema = self.schema
            new_schema_elements = self._get_new_schema_elements()
            self._delete_old_ui_components()
            self._create_ui_components()
            return new_schema_elements
        return None

    def _get_new_schema_elements(self) -> Set[str]:
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

    def record_analytics(self, user: User, new_schema_elements: Set[str] | None) -> None:
        analytics.record(
            "sentry_app.updated",
            user_id=user.id,
            organization_id=self.sentry_app.owner_id,
            sentry_app=self.sentry_app.slug,
            created_alert_rule_ui_component="alert-rule-action" in (new_schema_elements or set()),
        )


@dataclasses.dataclass
class SentryAppComponentPreparer:
    component: SentryAppComponent
    install: SentryAppInstallation
    project_slug: str | None = None
    values: List[Mapping[str, Any]] = dataclasses.field(default_factory=list)

    def call(self) -> None:
        with transaction.atomic():
            if self.component.type == "issue-link":
                self._prepare_issue_link()
            elif self.component.type == "stacktrace-link":
                self._prepare_stacktrace_link()
            elif self.component.type == "alert-rule-action":
                self._prepare_alert_rule_action()

    def _prepare_stacktrace_link(self) -> None:
        schema = self.component.schema
        uri = schema.get("uri")

        urlparts = list(urlparse(force_str(self.install.sentry_app.webhook_url)))
        urlparts[2] = uri

        query = {"installationId": self.install.uuid}

        if self.project_slug:
            query["projectSlug"] = self.project_slug

        urlparts[4] = urlencode(query)
        schema.update({"url": urlunparse(urlparts)})

    def _prepare_issue_link(self) -> None:
        schema = self.component.schema.copy()

        link = schema.get("link", {})
        create = schema.get("create", {})

        for field in link.get("required_fields", []):
            self._prepare_field(field)

        for field in link.get("optional_fields", []):
            self._prepare_field(field)

        for field in create.get("required_fields", []):
            self._prepare_field(field)

        for field in create.get("optional_fields", []):
            self._prepare_field(field)

    def _prepare_alert_rule_action(self) -> None:
        schema = self.component.schema.copy()
        settings = schema.get("settings", {})

        for field in settings.get("required_fields", []):
            self._prepare_field(field)

        for field in settings.get("optional_fields", []):
            self._prepare_field(field)

    def _prepare_field(self, field: MutableMapping[str, Any]) -> None:
        if "depends_on" in field:
            dependant_data_list = list(
                filter(lambda val: val["name"] in field.get("depends_on", {}), self.values)
            )
            if len(dependant_data_list) != len(field.get("depends_on", {})):
                field.update({"choices": []})
                return

            dependant_data = json.dumps({x["name"]: x["value"] for x in dependant_data_list})

            self._get_select_choices(field, dependant_data)
            return

        self._get_select_choices(field)

    def _get_select_choices(
        self, field: MutableMapping[str, Any], dependant_data: str | None = None
    ) -> None:
        if "options" in field:
            field.update({"choices": field["options"]})
            return

        if "uri" in field:
            if not field.get("skip_load_on_open"):
                field.update(self._request(field["uri"], dependent_data=dependant_data))

    def _request(self, uri: str, dependent_data: str | None = None) -> Any:
        return SelectRequester.run(
            install=self.install,
            project_slug=self.project_slug,
            uri=uri,
            dependent_data=dependent_data,
        )


def expand_events(rolled_up_events: List[str]) -> Set[str]:
    """
    Convert a list of rolled up events ('issue', etc) into a list of raw event
    types ('issue.created', etc.)
    """
    return set(
        chain.from_iterable([EVENT_EXPANSION.get(event, [event]) for event in rolled_up_events])
    )


def consolidate_events(raw_events: Iterable[str]) -> Set[str]:
    """
    Consolidate a list of raw event types ('issue.created', etc) into a list of
    rolled up events ('issue', etc).
    """
    return {
        name
        for (name, rolled_up_events) in EVENT_EXPANSION.items()
        if any(set(raw_events) & set(rolled_up_events))
    }
