from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable, Mapping
from typing import Any

from django.db.models import Q, QuerySet

from sentry.api.serializers import Serializer, serialize
from sentry.auth.services.auth import AuthenticationContext
from sentry.constants import SentryAppInstallationStatus, SentryAppStatus
from sentry.hybridcloud.rpc.filter_query import FilterQueryDatabaseImpl, OpaqueSerializedResponse
from sentry.sentry_apps.alert_rule_action_creator import SentryAppAlertRuleActionCreator
from sentry.sentry_apps.api.serializers.sentry_app_component import (
    SentryAppAlertRuleActionSerializer,
)
from sentry.sentry_apps.logic import SentryAppCreator
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_component import SentryAppComponent
from sentry.sentry_apps.models.sentry_app_installation import (
    SentryAppInstallation,
    prepare_sentry_app_components,
)
from sentry.sentry_apps.models.sentry_app_installation_token import SentryAppInstallationToken
from sentry.sentry_apps.services.app import (
    AppService,
    RpcAlertRuleActionResult,
    RpcSentryApp,
    RpcSentryAppComponent,
    RpcSentryAppComponentContext,
    RpcSentryAppEventData,
    RpcSentryAppInstallation,
    RpcSentryAppService,
    SentryAppInstallationFilterArgs,
)
from sentry.sentry_apps.services.app.model import SentryAppUpdateArgs
from sentry.sentry_apps.services.app.serial import (
    serialize_sentry_app,
    serialize_sentry_app_component,
    serialize_sentry_app_installation,
)
from sentry.sentry_apps.utils.errors import SentryAppErrorType
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


class DatabaseBackedAppService(AppService):
    def serialize_many(
        self,
        *,
        filter: SentryAppInstallationFilterArgs,
        as_user: RpcUser | None = None,
        auth_context: AuthenticationContext | None = None,
    ) -> list[OpaqueSerializedResponse]:
        return self._FQ.serialize_many(filter, as_user, auth_context)

    def get_many(
        self, *, filter: SentryAppInstallationFilterArgs
    ) -> list[RpcSentryAppInstallation]:
        return self._FQ.get_many(filter)

    def find_app_components(self, *, app_id: int) -> list[RpcSentryAppComponent]:
        return [
            serialize_sentry_app_component(c)
            for c in SentryAppComponent.objects.using_replica().filter(sentry_app_id=app_id)
        ]

    def get_sentry_app_by_id(self, *, id: int) -> RpcSentryApp | None:
        try:
            sentry_app = SentryApp.objects.using_replica().get(id=id)
        except SentryApp.DoesNotExist:
            return None
        return serialize_sentry_app(sentry_app)

    def get_installation_by_id(self, *, id: int) -> RpcSentryAppInstallation | None:
        try:
            install = SentryAppInstallation.objects.select_related("sentry_app").get(
                id=id, status=SentryAppInstallationStatus.INSTALLED
            )
            return serialize_sentry_app_installation(install)
        except SentryAppInstallation.DoesNotExist:
            return None

    def get_installation_org_id_by_token_id(self, token_id: int) -> int | None:
        filters: SentryAppInstallationFilterArgs = {
            "status": SentryAppInstallationStatus.INSTALLED,
            "api_installation_token_id": token_id,
        }
        queryset = self._FQ.apply_filters(SentryAppInstallation.objects.all(), filters)
        install = queryset.first()
        if not install:
            return None
        return install.organization_id

    def get_sentry_app_by_slug(self, *, slug: str) -> RpcSentryApp | None:
        try:
            sentry_app = SentryApp.objects.get(slug=slug)
            return serialize_sentry_app(sentry_app)
        except SentryApp.DoesNotExist:
            return None

    def get_sentry_apps_by_proxy_users(self, *, proxy_user_ids: list[int]) -> list[RpcSentryApp]:
        sentry_apps = SentryApp.objects.filter(proxy_user_id__in=proxy_user_ids).prefetch_related(
            "avatar"
        )
        return [
            serialize_sentry_app(app=app, avatars=list(app.avatar.all())) for app in sentry_apps
        ]

    def get_installations_for_organization(
        self, *, organization_id: int
    ) -> list[RpcSentryAppInstallation]:
        installations = SentryAppInstallation.objects.get_installed_for_organization(
            organization_id
        ).select_related("sentry_app", "api_token")
        fq = self._AppServiceFilterQuery()
        return [fq.serialize_rpc(i) for i in installations]

    def find_alertable_services(self, *, organization_id: int) -> list[RpcSentryAppService]:
        result: list[RpcSentryAppService] = []
        for app in SentryApp.objects.filter(
            installations__organization_id=organization_id,
            is_alertable=True,
            installations__status=SentryAppInstallationStatus.INSTALLED,
            installations__date_deleted=None,
        ).distinct("id"):
            if SentryAppComponent.objects.filter(
                sentry_app_id=app.id, type="alert-rule-action"
            ).exists():
                continue
            result.append(
                RpcSentryAppService(
                    title=app.name,
                    slug=app.slug,
                )
            )
        return result

    def get_custom_alert_rule_actions(
        self, *, event_data: RpcSentryAppEventData, organization_id: int, project_slug: str | None
    ) -> list[Mapping[str, Any]]:
        action_list = []
        for install in SentryAppInstallation.objects.get_installed_for_organization(
            organization_id
        ):
            component = prepare_sentry_app_components(install, "alert-rule-action", project_slug)
            if component:
                kwargs = {
                    "install": install,
                    "event_action": event_data,
                }
                action_details = serialize(
                    component, None, SentryAppAlertRuleActionSerializer(), **kwargs
                )
                action_list.append(action_details)

        return action_list

    def get_component_contexts(
        self, *, filter: SentryAppInstallationFilterArgs, component_type: str
    ) -> list[RpcSentryAppComponentContext]:
        install_query = self._FQ.query_many(filter=filter)
        install_query = install_query.select_related("sentry_app", "sentry_app__application")
        install_map: dict[int, list[SentryAppInstallation]] = defaultdict(list)
        for install in install_query:
            install_map[install.sentry_app_id].append(install)
        component_query = SentryAppComponent.objects.filter(
            type=component_type, sentry_app_id__in=list(install_map.keys())
        )
        output = []
        for component in component_query:
            installs = install_map[component.sentry_app_id]
            for install in installs:
                context_item = RpcSentryAppComponentContext(
                    installation=serialize_sentry_app_installation(
                        installation=install, app=install.sentry_app
                    ),
                    component=serialize_sentry_app_component(component),
                )
                output.append(context_item)
        return output

    def get_installation_component_contexts(
        self,
        *,
        filter: SentryAppInstallationFilterArgs,
        component_type: str,
        include_contexts_without_component: bool = False,
    ) -> list[RpcSentryAppComponentContext]:
        install_query = self._FQ.query_many(filter=filter)
        app_ids = install_query.values_list("sentry_app_id", flat=True)

        component_query = SentryAppComponent.objects.filter(
            type=component_type, sentry_app_id__in=list(app_ids)
        )
        component_map: dict[int, SentryAppComponent] = {}
        output = []

        for component in component_query:
            component_map[component.sentry_app_id] = component

        for install in install_query:
            install_component = component_map.get(install.sentry_app_id)
            if include_contexts_without_component or install_component:
                context_item = RpcSentryAppComponentContext(
                    installation=serialize_sentry_app_installation(
                        installation=install, app=install.sentry_app
                    ),
                    component=(
                        serialize_sentry_app_component(install_component)
                        if install_component
                        else None
                    ),
                )
                output.append(context_item)
        return output

    class _AppServiceFilterQuery(
        FilterQueryDatabaseImpl[
            SentryAppInstallation, SentryAppInstallationFilterArgs, RpcSentryAppInstallation, None
        ]
    ):
        def base_query(self, select_related: bool = True) -> QuerySet[SentryAppInstallation]:
            if not select_related:
                return SentryAppInstallation.objects.all()
            return SentryAppInstallation.objects.select_related("sentry_app")

        def filter_arg_validator(
            self,
        ) -> Callable[[SentryAppInstallationFilterArgs], str | None]:
            return self._filter_has_any_key_validator(
                "organization_id",
                "installation_ids",
                "app_ids",
                "uuids",
                "status",
                "proxy_user_ids",
            )

        def serialize_api(self, serializer: None) -> Serializer:
            raise NotImplementedError("Serialization not supported for AppService")

        def apply_filters(
            self, query: QuerySet[SentryAppInstallation], filters: SentryAppInstallationFilterArgs
        ) -> QuerySet[SentryAppInstallation]:
            if "installation_ids" in filters:
                query = query.filter(id__in=filters["installation_ids"])
            if "app_ids" in filters:
                query = query.filter(sentry_app_id__in=filters["app_ids"])
            if "organization_id" in filters:
                query = query.filter(organization_id=filters["organization_id"])
            if "uuids" in filters:
                query = query.filter(uuid__in=filters["uuids"])
            if "status" in filters:
                query = query.filter(status=filters["status"])
            if "api_token_id" in filters:
                query = query.filter(api_token_id=filters["api_token_id"])
            if "api_installation_token_id" in filters:
                # NOTE: This is similar to 'api_token_id' above, but if we are unable to find
                # the installation by token id in SentryAppInstallation, we also search
                # SentryAppInstallationToken by token id, then fetch  the linked installation.
                # Internal Integrations follow this pattern because they can have multiple tokens.

                # Decompose this query instead of using a subquery for performance.
                install_token_list = SentryAppInstallationToken.objects.filter(
                    api_token_id=filters["api_installation_token_id"],
                ).values_list("sentry_app_installation_id", flat=True)

                query = query.filter(
                    Q(api_token_id=filters["api_installation_token_id"])
                    | Q(id__in=list(install_token_list))
                )

            return query

        def serialize_rpc(self, object: SentryAppInstallation) -> RpcSentryAppInstallation:
            return serialize_sentry_app_installation(object)

    _FQ = _AppServiceFilterQuery()

    def find_installation_by_proxy_user(
        self, *, proxy_user_id: int, organization_id: int
    ) -> RpcSentryAppInstallation | None:
        try:
            sentry_app = SentryApp.objects.get(proxy_user_id=proxy_user_id)
        except SentryApp.DoesNotExist:
            return None

        try:
            installation = SentryAppInstallation.objects.get(
                sentry_app_id=sentry_app.id, organization_id=organization_id
            )
        except SentryAppInstallation.DoesNotExist:
            return None

        return serialize_sentry_app_installation(installation, sentry_app)

    def get_installation_token(self, *, organization_id: int, provider: str) -> str | None:
        return SentryAppInstallationToken.objects.get_token(organization_id, provider)

    def trigger_sentry_app_action_creators(
        self, *, fields: list[Mapping[str, Any]], install_uuid: str | None
    ) -> RpcAlertRuleActionResult:
        try:
            install = SentryAppInstallation.objects.get(uuid=install_uuid)
        except SentryAppInstallation.DoesNotExist:
            return RpcAlertRuleActionResult(
                success=False,
                message="Installation does not exist",
                error_type=SentryAppErrorType.SENTRY,
                webhook_type={"installation_uuid": install_uuid},
            )
        result = SentryAppAlertRuleActionCreator(install=install, fields=fields).run()
        return RpcAlertRuleActionResult(
            success=result["success"],
            message=result["message"],
            error_type=result.get("error_type"),
            webhook_context=result.get("webhook_context"),
            public_context=result.get("public_context"),
            status_code=result.get("status_code"),
        )

    def find_service_hook_sentry_app(self, *, api_application_id: int) -> RpcSentryApp | None:
        try:
            return serialize_sentry_app(SentryApp.objects.get(application_id=api_application_id))
        except SentryApp.DoesNotExist:
            return None

    def get_published_sentry_apps_for_organization(
        self, *, organization_id: int
    ) -> list[RpcSentryApp]:
        published_apps = SentryApp.objects.filter(
            owner_id=organization_id, status=SentryAppStatus.PUBLISHED
        )
        return [serialize_sentry_app(app) for app in published_apps]

    def get_sentry_apps_for_organization(self, *, organization_id: int) -> list[RpcSentryApp]:
        """
        Get active Sentry Apps for a given organization
        """
        sentry_apps = SentryApp.objects.filter(
            owner_id=organization_id, application__isnull=False
        ).exclude(status=SentryAppStatus.DELETION_IN_PROGRESS)
        return [serialize_sentry_app(app) for app in sentry_apps]

    def update_sentry_app(
        self,
        *,
        id: int,
        attrs: SentryAppUpdateArgs,
    ) -> RpcSentryApp | None:
        try:
            sentry_app = SentryApp.objects.get(id=id)
        except SentryApp.DoesNotExist:
            return None

        if len(attrs):
            for k, v in attrs.items():
                setattr(sentry_app, k, v)
            sentry_app.save()

        return serialize_sentry_app(sentry_app)

    def get_internal_integrations(
        self, *, organization_id: int, integration_name: str
    ) -> list[RpcSentryApp]:
        """
        Get all internal integrations for an organization matching a specific name.

        Internal integrations are Sentry Apps that are created for use within a single
        organization and are not available to be installed by users.

        Args:
            organization_id (int): The ID of the organization to search within
            integration_name (str): The name of the internal integration to find

        Returns:
            list[RpcSentryApp]: A list of serialized internal Sentry Apps matching the criteria.
                               Returns an empty list if no matches are found.
        """
        internal_integrations = SentryApp.objects.filter(
            owner_id=organization_id,
            status=SentryAppStatus.INTERNAL,
            name=integration_name,
        )
        return [serialize_sentry_app(app) for app in internal_integrations]

    def create_internal_integration_for_channel_request(
        self,
        *,
        organization_id: int,
        integration_name: str,
        integration_scopes: list[str],
        integration_creator_id: int,
        metadata: dict[str, Any] | None = None,
    ) -> RpcSentryAppInstallation:
        admin_user = User.objects.get(id=integration_creator_id)

        sentry_app_query = SentryApp.objects.filter(
            owner_id=organization_id,
            name=integration_name,
            creator_user=admin_user,
            creator_label=admin_user.email
            or admin_user.username,  # email is not required for some users (sentry apps)
        )
        sentry_app = sentry_app_query[0] if sentry_app_query.exists() else None
        if sentry_app:
            installation = SentryAppInstallation.objects.get(sentry_app=sentry_app)
        else:
            sentry_app = SentryAppCreator(
                name=integration_name,
                author=admin_user.username,
                organization_id=organization_id,
                is_internal=True,
                scopes=integration_scopes,
                verify_install=False,
                metadata=metadata,
            ).run(user=admin_user)
            installation = SentryAppInstallation.objects.get(sentry_app=sentry_app)

        return serialize_sentry_app_installation(installation=installation, app=sentry_app)

    def prepare_sentry_app_components(
        self, *, installation_id: int, component_type: str, project_slug: str | None = None
    ) -> RpcSentryAppComponent | None:
        from sentry.sentry_apps.models.sentry_app_installation import prepare_sentry_app_components

        try:
            installation = SentryAppInstallation.objects.get(id=installation_id)
        except SentryAppInstallation.DoesNotExist:
            # Installations are cached, so there is a chance that is has been deleted
            return None
        component = prepare_sentry_app_components(installation, component_type, project_slug)
        return serialize_sentry_app_component(component) if component else None

    def disable_sentryapp(self, *, id: int) -> None:
        try:
            sentryapp = SentryApp.objects.get(id=id)
        except SentryApp.DoesNotExist:
            return
        sentryapp._disable()
