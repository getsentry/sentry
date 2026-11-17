from __future__ import annotations

import logging
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from typing import Annotated, Any, TypedDict, cast

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register, serialize
from sentry.apidocs.descriptions import ApiDescription
from sentry.constants import ObjectStatus, ObjectStatusName
from sentry.hybridcloud.rpc.service import RpcException
from sentry.integrations.base import IntegrationProvider
from sentry.integrations.constants import SlackScope
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration import (
    RpcIntegration,
    RpcOrganizationIntegration,
    integration_service,
)
from sentry.integrations.types import IntegrationIssueConfigField
from sentry.integrations.utils.github_permission_tiers import get_permission_tiers
from sentry.integrations.utils.github_permissions import (
    GITHUB_APP_LATEST_PERMISSIONS,
    get_missing_github_app_permissions,
    is_permissions_snapshot_stale,
)
from sentry.organizations.services.organization import RpcOrganization, organization_service
from sentry.shared_integrations.exceptions import ApiError
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser

logger = logging.getLogger(__name__)


class MissingFeature(TypedDict):
    """A feature the installation can no longer support, named by the permission
    tier it falls short of, so the update-permissions modal can list them."""

    key: Annotated[str, ApiDescription("Key of the missing feature")]
    description: Annotated[str, ApiDescription("Description of the missing feature")]


class OrganizationIntegrationResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the integration")]
    name: Annotated[
        str, ApiDescription("Name of the integration, usually the connected account or workspace")
    ]
    icon: Annotated[str | None, ApiDescription("URL of the connected account's icon")]
    domainName: Annotated[
        str | None,
        ApiDescription("Domain of the connected account, such as github.com/example-org"),
    ]
    accountType: Annotated[
        str | None, ApiDescription("Type of the connected account, such as Organization or User")
    ]
    scopes: Annotated[
        list[str] | None, ApiDescription("Permission scopes granted to the integration")
    ]
    outOfDate: Annotated[
        bool | None,
        ApiDescription(
            "Whether the installation lacks permissions the latest version of the integration needs. Null for providers without a permissions model"
        ),
    ]
    missingFeatures: Annotated[
        list[MissingFeature] | None,
        ApiDescription(
            "Features the installation can't support because of missing permissions. Null for providers without a permissions model"
        ),
    ]
    status: Annotated[ObjectStatusName, ApiDescription("Status of the integration")]
    provider: Annotated[IntegrationProviderInfo, ApiDescription("Integration provider details")]
    configOrganization: Annotated[
        Any, ApiDescription("Organization-level configuration fields of the integration")
    ]
    configData: Annotated[
        Any, ApiDescription("Configuration values the organization set for the integration")
    ]
    externalId: Annotated[str, ApiDescription("ID of the connected account in the provider")]
    organizationId: Annotated[
        int, ApiDescription("ID of the organization the integration is installed in")
    ]
    organizationIntegrationStatus: Annotated[
        ObjectStatusName, ApiDescription("Status of the integration in this organization")
    ]
    gracePeriodEnd: Annotated[
        datetime | None,
        ApiDescription(
            "When the integration's grace period ends (ISO 8601). Null when there's no grace period"
        ),
    ]


class IntegrationAlert(TypedDict):
    type: Annotated[str, ApiDescription("Style of the alert, such as warning")]
    icon: Annotated[str, ApiDescription("Icon shown with the alert, such as icon-warning-sm")]
    text: Annotated[str, ApiDescription("Text of the alert, in Markdown")]


class IntegrationDialog(TypedDict):
    actionText: Annotated[str, ApiDescription("Label of the dialog's confirm button")]
    body: Annotated[str, ApiDescription("Text of the dialog")]


class IntegrationExternalInstall(TypedDict):
    url: Annotated[
        str, ApiDescription("URL to install the integration from, such as a marketplace")
    ]
    buttonText: Annotated[str, ApiDescription("Label of the install button")]
    noticeText: Annotated[str, ApiDescription("Notice shown before the user leaves Sentry")]


class IntegrationConfigureIntegration(TypedDict):
    title: Annotated[str, ApiDescription("Title of the configuration step")]


class IntegrationAspects(TypedDict, total=False):
    """Matches `IntegrationAspects` in static/app/types/integrations.tsx."""

    alerts: Annotated[list[IntegrationAlert], ApiDescription("Alerts shown during setup")]
    configure_integration: Annotated[
        IntegrationConfigureIntegration, ApiDescription("Configuration step after install")
    ]
    directEnable: Annotated[
        bool, ApiDescription("Whether the integration is enabled without an install flow")
    ]
    disable_dialog: Annotated[
        IntegrationDialog, ApiDescription("Dialog shown before the integration is disabled")
    ]
    externalInstall: Annotated[
        IntegrationExternalInstall,
        ApiDescription("Where to install the integration when it's installed outside Sentry"),
    ]
    removal_dialog: Annotated[
        IntegrationDialog, ApiDescription("Dialog shown before the integration is removed")
    ]


class IntegrationFeatureDescription(TypedDict):
    description: Annotated[str, ApiDescription("Description of the feature, in Markdown")]
    featureGate: Annotated[
        str | None,
        ApiDescription(
            "Organization feature flag that gates the feature, such as integrations-commits"
        ),
    ]


class IntegrationMetadataResponse(TypedDict):
    """`IntegrationMetadata.asdict()`."""

    description: Annotated[str, ApiDescription("Description of the integration, in Markdown")]
    features: Annotated[
        list[IntegrationFeatureDescription], ApiDescription("Features the integration provides")
    ]
    author: Annotated[str, ApiDescription("Author of the integration")]
    noun: Annotated[
        str, ApiDescription("Noun for one installation, such as Installation or Account")
    ]
    issue_url: Annotated[str, ApiDescription("URL to report problems with the integration")]
    source_url: Annotated[str, ApiDescription("URL of the integration's source or docs")]
    aspects: Annotated[
        IntegrationAspects,
        ApiDescription(
            "Extra provider details shown during setup, such as alerts and configuration instructions"
        ),
    ]


class IntegrationProviderInfo(TypedDict):
    key: Annotated[str, ApiDescription("Key of the integration provider, such as github")]
    slug: Annotated[str, ApiDescription("Slug of the integration provider, same as key")]
    name: Annotated[str, ApiDescription("Display name of the integration provider")]
    canAdd: Annotated[bool, ApiDescription("Whether the integration can be installed from Sentry")]
    canDisable: Annotated[
        bool,
        ApiDescription(
            "Whether the integration must be uninstalled from the provider instead of in Sentry"
        ),
    ]
    features: Annotated[
        list[str],
        ApiDescription(
            "Features the integration provider supports, such as issue-basic or commits"
        ),
    ]
    aspects: Annotated[
        IntegrationAspects,
        ApiDescription(
            "Extra provider details shown during setup, such as alerts and configuration instructions"
        ),
    ]


# converts the provider to JSON
def serialize_provider(provider: IntegrationProvider) -> IntegrationProviderInfo:
    return {
        "key": provider.key,
        "slug": provider.key,
        "name": provider.name,
        "canAdd": provider.can_add,
        "canDisable": provider.can_disable,
        "features": sorted(f.value for f in provider.features),
        # test_integration_provider_types checks every provider's aspects against the TypedDict.
        "aspects": cast(IntegrationAspects, getattr(provider.metadata, "aspects", {})),
    }


class IntegrationSerializerResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the integration")]
    name: Annotated[
        str, ApiDescription("Name of the integration, usually the connected account or workspace")
    ]
    icon: Annotated[str | None, ApiDescription("URL of the connected account's icon")]
    domainName: Annotated[
        str | None,
        ApiDescription("Domain of the connected account, such as github.com/example-org"),
    ]
    accountType: Annotated[
        str | None, ApiDescription("Type of the connected account, such as Organization or User")
    ]
    scopes: Annotated[
        list[str] | None, ApiDescription("Permission scopes granted to the integration")
    ]
    outOfDate: Annotated[
        bool | None,
        ApiDescription(
            "Whether the installation lacks permissions the latest version of the integration needs. Null for providers without a permissions model"
        ),
    ]
    # Features blocked by missing permissions. GitHub tiers are oldest first.
    # None for providers without a permissions model.
    missingFeatures: Annotated[
        list[MissingFeature] | None,
        ApiDescription(
            "Features the installation can't support because of missing permissions. Null for providers without a permissions model"
        ),
    ]
    status: Annotated[ObjectStatusName, ApiDescription("Status of the integration")]
    provider: Annotated[IntegrationProviderInfo, ApiDescription("Integration provider details")]


@register(Integration)
class IntegrationSerializer(Serializer):
    def serialize(
        self,
        obj: Integration | RpcIntegration,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> IntegrationSerializerResponse:
        provider = obj.get_provider()

        out_of_date = None
        missing_features: list[MissingFeature] | None = None

        match provider.key:
            case "github":
                out_of_date = bool(get_missing_github_app_permissions(obj.metadata))
                # Read missing permissions as "holds none", the same way
                # outOfDate does, so an install flagged out of date always
                # names the features it is missing.
                permissions = obj.metadata.get("permissions") or {}
                tiers = get_permission_tiers(permissions, GITHUB_APP_LATEST_PERMISSIONS)
                missing_features = [
                    {"key": tier.key, "description": tier.description} for tier in reversed(tiers)
                ]
                if out_of_date and is_permissions_snapshot_stale(obj.metadata):
                    # The banner still shows, but this answer is a guess: the
                    # snapshot predates the app's permissions change, so it was
                    # read against the old required set and may be naming
                    # permissions this install was never asked for. Logged
                    # rather than resolved because serializing a page is the
                    # wrong place to mint a GitHub token, once per integration
                    # on the list, to find out.
                    logger.warning(
                        "github_permissions.stale_snapshot",
                        extra={"integration_id": obj.id},
                    )
            case "slack":
                out_of_date = SlackScope.APP_MENTIONS_READ not in (obj.metadata.get("scopes") or [])
                missing_features = []
                if out_of_date:
                    missing_features.append(
                        {
                            "key": "seer_mentions",
                            "description": (
                                "Mention @Sentry in Slack to ask any questions and investigate issues."
                            ),
                        }
                    )

        return {
            "id": str(obj.id),
            "name": obj.name,
            "icon": obj.metadata.get("icon"),
            "domainName": obj.metadata.get("domain_name"),
            "accountType": obj.metadata.get("account_type"),
            "scopes": obj.metadata.get("scopes"),
            "outOfDate": out_of_date,
            "missingFeatures": missing_features,
            "status": cast(ObjectStatusName, obj.get_status_display()),
            "provider": serialize_provider(provider),
        }


class IntegrationConfigSerializerResponse(IntegrationSerializerResponse, total=False):
    configOrganization: Sequence[Any]
    createIssueConfig: list[IntegrationIssueConfigField]


class IntegrationConfigSerializer(IntegrationSerializer):
    def __init__(
        self, organization_id: int | None = None, params: Mapping[str, Any] | None = None
    ) -> None:
        self.organization_id = organization_id
        self.params = params or {}

    def serialize(
        self,
        obj: RpcIntegration | Integration,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        include_config: bool = True,
        organization: RpcOrganization | None = None,
        **kwargs: Any,
    ) -> IntegrationConfigSerializerResponse:
        base = super().serialize(obj, attrs, user)

        if not include_config:
            return cast("IntegrationConfigSerializerResponse", base)

        if not self.organization_id:
            return cast("IntegrationConfigSerializerResponse", {**base, "configOrganization": []})

        try:
            installation = obj.get_installation(organization_id=self.organization_id)
        except NotImplementedError:
            # The integration may not implement a Installed Integration object
            # representation.
            return cast("IntegrationConfigSerializerResponse", {**base, "configOrganization": []})

        if organization is not None:
            installation.organization = organization

        # TicketRuleModal only needs the ticket-creation form for this request.
        if self.params.get("action") == "create":
            return cast(
                "IntegrationConfigSerializerResponse",
                {
                    **base,
                    "configOrganization": [],
                    # This method comes from IssueBasicIntegration within the integration's installation class
                    "createIssueConfig": installation.get_create_issue_config(  # type: ignore[attr-defined]
                        None,
                        user,
                        params=self.params,
                    ),
                },
            )

        return cast(
            "IntegrationConfigSerializerResponse",
            {**base, "configOrganization": installation.get_organization_config()},
        )


@register(OrganizationIntegration)
class OrganizationIntegrationSerializer(Serializer):
    def __init__(self, params: Mapping[str, Any] | None = None) -> None:
        self.params = params or {}

    def get_attrs(
        self,
        item_list: Sequence[RpcOrganizationIntegration],
        user: User | RpcUser | AnonymousUser,
        include_config: bool = True,
        **kwargs: Any,
    ) -> MutableMapping[RpcOrganizationIntegration, MutableMapping[str, Any]]:
        integrations = integration_service.get_integrations(
            integration_ids=[item.integration_id for item in item_list]
        )
        integrations_by_id: dict[int, RpcIntegration] = {i.id: i for i in integrations}
        organizations: dict[int, RpcOrganization | None] = {}
        if include_config:
            for organization_id in {item.organization_id for item in item_list}:
                try:
                    organizations[organization_id] = organization_service.get(id=organization_id)
                except RpcException:
                    # Fall back to per-installation lookups and their existing error handling.
                    # A failed prefetch must not prevent unrelated integrations from rendering.
                    continue
        return {
            item: {
                "integration": integrations_by_id[item.integration_id],
                "organization": organizations.get(item.organization_id),
            }
            for item in item_list
        }

    def serialize(
        self,
        obj: RpcOrganizationIntegration,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        include_config: bool = True,
        **kwargs: Any,
    ) -> MutableMapping[str, Any]:
        # XXX(epurkhiser): This is O(n) for integrations, especially since
        # we're using the IntegrationConfigSerializer which pulls in the
        # integration installation config object which very well may be making
        # API request for config options.
        integration: RpcIntegration = attrs.get("integration")  # type: ignore[assignment]
        organization: RpcOrganization | None = attrs.get("organization")
        integration_config = serialize(
            objects=integration,
            user=user,
            serializer=IntegrationConfigSerializer(obj.organization_id, params=self.params),
            include_config=include_config,
            organization=organization,
        )
        serialized_integration: MutableMapping[str, Any] = {**integration_config}

        organization_integration_fields = {
            "externalId": integration.external_id,
            "organizationId": obj.organization_id,
            "organizationIntegrationStatus": cast(ObjectStatusName, obj.get_status_display()),
            "gracePeriodEnd": obj.grace_period_end,
        }
        if self.params.get("action") == "create":
            serialized_integration.update({"configData": None, **organization_integration_fields})
            return serialized_integration

        dynamic_display_information = None
        config_data = None

        try:
            installation = integration.get_installation(organization_id=obj.organization_id)
        except NotImplementedError:
            # slack doesn't have an installation implementation
            config_data = obj.config if include_config else None
        else:
            try:
                if organization is not None:
                    installation.organization = organization
                installation.org_integration = obj
                config_data = installation.get_config_data() if include_config else None  # type: ignore[assignment]
                dynamic_display_information = installation.get_dynamic_display_information()
            except ApiError as e:
                # If there is an ApiError from our 3rd party integration
                # providers, assume there is an problem with the configuration
                # and set it to disabled.
                serialized_integration.update({"status": "disabled"})
                name = "sentry.serializers.model.organizationintegration"
                log_info = {
                    "error": str(e),
                    "integration_id": integration.id,
                    "integration_provider": integration.provider,
                }
                logger.info(name, extra=log_info)

        serialized_integration.update(
            {
                "configData": config_data,
                **organization_integration_fields,
            }
        )

        if dynamic_display_information:
            serialized_integration.update(
                {"dynamicDisplayInformation": dynamic_display_information}
            )
        return serialized_integration


class IntegrationProviderResponse(TypedDict):
    key: Annotated[str, ApiDescription("Key of the integration provider, such as github")]
    slug: Annotated[str, ApiDescription("Slug of the integration provider, same as key")]
    name: Annotated[str, ApiDescription("Display name of the integration provider")]
    metadata: Annotated[
        IntegrationMetadataResponse | None,
        ApiDescription(
            "Provider metadata, such as description, author, source URL and setup details"
        ),
    ]
    canAdd: Annotated[bool, ApiDescription("Whether the integration can be installed from Sentry")]
    canDisable: Annotated[
        bool,
        ApiDescription(
            "Whether the integration must be uninstalled from the provider instead of in Sentry"
        ),
    ]
    features: Annotated[
        list[str],
        ApiDescription(
            "Features the integration provider supports, such as issue-basic or commits"
        ),
    ]


class IntegrationProviderSerializer(Serializer[IntegrationProviderResponse]):
    def get_attrs(
        self,
        item_list: Sequence[IntegrationProvider],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[IntegrationProvider, MutableMapping[str, Any]]:
        organization = kwargs["organization"]

        # Only providers that disallow a second installation need to know whether one
        # already exists, so restrict the lookup to those keys (and skip it entirely
        # when there are none).
        keys = [
            provider.key
            for provider in item_list
            if provider.can_add and not provider.allow_multiple
        ]
        installed_provider_keys: set[str] = set()
        if keys:
            installed_provider_keys = {
                integration.provider
                for integration in integration_service.get_integrations(
                    organization_id=organization.id,
                    providers=keys,
                    status=ObjectStatus.ACTIVE,
                )
            }

        return {
            provider: {"has_existing_integration": provider.key in installed_provider_keys}
            for provider in item_list
        }

    def serialize(
        self,
        obj: IntegrationProvider,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> IntegrationProviderResponse:
        # test_integration_provider_types checks every provider's metadata against the TypedDict.
        metadata = cast(
            IntegrationMetadataResponse | None, obj.metadata and obj.metadata.asdict() or None
        )

        can_add = obj.can_add
        if can_add and not obj.allow_multiple and attrs["has_existing_integration"]:
            can_add = False

        return {
            "key": obj.key,
            "slug": obj.key,
            "name": obj.name,
            "metadata": metadata,
            "canAdd": can_add,
            "canDisable": obj.can_disable,
            "features": [f.value for f in obj.features],
        }
