from __future__ import annotations

import logging
from typing import Any, Dict, List, Mapping, MutableMapping, Optional, Sequence

from typing_extensions import TypedDict

from sentry.api.serializers import Serializer, register, serialize
from sentry.integrations import IntegrationProvider
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.user import User
from sentry.services.hybrid_cloud.integration import (
    RpcIntegration,
    RpcOrganizationIntegration,
    integration_service,
)
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.json import JSONData

logger = logging.getLogger(__name__)


class OrganizationIntegrationResponse(TypedDict):
    id: str
    name: str
    icon: Optional[str]
    domainName: Optional[str]
    accountType: Optional[str]
    scopes: Optional[List[str]]
    status: str
    provider: Any
    configOrganization: Any
    configData: Any
    externalId: str
    organizationId: int
    organizationIntegrationStatus: str
    gracePeriodEnd: Optional[str]


# converts the provider to JSON
def serialize_provider(provider: IntegrationProvider) -> Mapping[str, Any]:
    return {
        "key": provider.key,
        "slug": provider.key,
        "name": provider.name,
        "canAdd": provider.can_add,
        "canDisable": provider.can_disable,
        "features": sorted(f.value for f in provider.features),
        "aspects": provider.metadata.aspects,
    }


@register(Integration)
class IntegrationSerializer(Serializer):
    def serialize(
        self, obj: Integration | RpcIntegration, attrs: Mapping[str, Any], user: User, **kwargs: Any
    ) -> MutableMapping[str, JSONData]:
        provider = obj.get_provider()
        return {
            "id": str(obj.id),
            "name": obj.name,
            "icon": obj.metadata.get("icon"),
            "domainName": obj.metadata.get("domain_name"),
            "accountType": obj.metadata.get("account_type"),
            "scopes": obj.metadata.get("scopes"),
            "status": obj.get_status_display(),
            "provider": serialize_provider(provider),
        }


class IntegrationConfigSerializer(IntegrationSerializer):
    def __init__(
        self, organization_id: Optional[int] = None, params: Optional[Mapping[str, Any]] = None
    ) -> None:
        self.organization_id = organization_id
        self.params = params or {}

    def serialize(
        self,
        obj: RpcIntegration,
        attrs: Mapping[str, Any],
        user: User,
        include_config: bool = True,
        **kwargs: Any,
    ) -> MutableMapping[str, JSONData]:
        data = super().serialize(obj, attrs, user)

        if not include_config:
            return data

        data.update({"configOrganization": []})

        if not self.organization_id:
            return data

        try:
            install = obj.get_installation(organization_id=self.organization_id)
        except NotImplementedError:
            # The integration may not implement a Installed Integration object
            # representation.
            pass
        else:
            data.update({"configOrganization": install.get_organization_config()})

            # Query param "action" only attached in TicketRuleForm modal.
            if self.params.get("action") == "create":
                # This method comes from IssueBasicMixin within the integration's installation class
                data["createIssueConfig"] = install.get_create_issue_config(  # type: ignore
                    None, user, params=self.params
                )

        return data


@register(OrganizationIntegration)
class OrganizationIntegrationSerializer(Serializer):
    def __init__(self, params: Optional[Mapping[str, Any]] = None) -> None:
        self.params = params

    def get_attrs(
        self,
        item_list: Sequence[RpcOrganizationIntegration],
        user: User,
        **kwargs: Any,
    ) -> MutableMapping[RpcOrganizationIntegration, MutableMapping[str, Any]]:
        integrations = integration_service.get_integrations(
            integration_ids=[item.integration_id for item in item_list]
        )
        integrations_by_id: Dict[int, RpcIntegration] = {i.id: i for i in integrations}
        return {
            item: {"integration": integrations_by_id[item.integration_id]} for item in item_list
        }

    def serialize(
        self,
        obj: RpcOrganizationIntegration,
        attrs: Mapping[str, Any],
        user: User,
        include_config: bool = True,
    ) -> MutableMapping[str, JSONData]:
        # XXX(epurkhiser): This is O(n) for integrations, especially since
        # we're using the IntegrationConfigSerializer which pulls in the
        # integration installation config object which very well may be making
        # API request for config options.
        integration: RpcIntegration = attrs.get("integration")  # type: ignore
        serialized_integration: MutableMapping[str, Any] = serialize(
            objects=integration,
            user=user,
            serializer=IntegrationConfigSerializer(obj.organization_id, params=self.params),
            include_config=include_config,
        )

        dynamic_display_information = None
        config_data = None

        try:
            installation = integration.get_installation(organization_id=obj.organization_id)
        except NotImplementedError:
            # slack doesn't have an installation implementation
            config_data = obj.config if include_config else None
        else:
            try:
                # just doing this to avoid querying for an object we already have
                installation._org_integration = obj
                config_data = installation.get_config_data() if include_config else None  # type: ignore
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
                "externalId": integration.external_id,
                "organizationId": obj.organization_id,
                "organizationIntegrationStatus": obj.get_status_display(),
                "gracePeriodEnd": obj.grace_period_end,
            }
        )

        if dynamic_display_information:
            serialized_integration.update(
                {"dynamicDisplayInformation": dynamic_display_information}
            )
        return serialized_integration


class IntegrationProviderSerializer(Serializer):
    def serialize(
        self, obj: IntegrationProvider, attrs: Mapping[str, Any], user: User, **kwargs: Any
    ) -> MutableMapping[str, JSONData]:
        org_slug = kwargs.pop("organization").slug
        metadata = obj.metadata
        metadata = metadata and metadata._asdict() or None

        return {
            "key": obj.key,
            "slug": obj.key,
            "name": obj.name,
            "metadata": metadata,
            "canAdd": obj.can_add,
            "canDisable": obj.can_disable,
            "features": [f.value for f in obj.features],
            "setupDialog": dict(
                url=f"/organizations/{org_slug}/integrations/{obj.key}/setup/",
                **obj.setup_dialog_config,
            ),
        }
