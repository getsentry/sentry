import logging
from collections import defaultdict

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import (
    ExternalIssue,
    GroupLink,
    Integration,
    OrganizationIntegration,
    ExternalTeam,
    ExternalUser,
)
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger(__name__)


# converts the provider to JSON
def serialize_provider(provider):
    return {
        "key": provider.key,
        "slug": provider.key,
        "name": provider.name,
        "canAdd": provider.can_add,
        "canDisable": provider.can_disable,
        "features": sorted([f.value for f in provider.features]),
        "aspects": provider.metadata.aspects,
    }


@register(Integration)
class IntegrationSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        provider = obj.get_provider()
        return {
            "id": str(obj.id),
            "name": obj.name,
            "icon": obj.metadata.get("icon"),
            "domainName": obj.metadata.get("domain_name"),
            "accountType": obj.metadata.get("account_type"),
            "status": obj.get_status_display(),
            "provider": serialize_provider(provider),
        }


class IntegrationConfigSerializer(IntegrationSerializer):
    def __init__(self, organization_id=None, params=None):
        self.organization_id = organization_id
        self.params = params or {}

    def serialize(self, obj, attrs, user, include_config=True):
        data = super().serialize(obj, attrs, user)

        if not include_config:
            return data

        data.update({"configOrganization": []})

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
                data["createIssueConfig"] = install.get_create_issue_config(
                    None, user, params=self.params
                )

        return data


@register(OrganizationIntegration)
class OrganizationIntegrationSerializer(Serializer):
    def __init__(self, params=None):
        self.params = params

    def serialize(self, obj, attrs, user, include_config=True):
        # XXX(epurkhiser): This is O(n) for integrations, especially since
        # we're using the IntegrationConfigSerializer which pulls in the
        # integration installation config object which very well may be making
        # API request for config options.
        integration = serialize(
            objects=obj.integration,
            user=user,
            serializer=IntegrationConfigSerializer(obj.organization.id, params=self.params),
            include_config=include_config,
        )

        dynamic_display_information = None
        config_data = None

        try:
            installation = obj.integration.get_installation(obj.organization_id)
        except NotImplementedError:
            # slack doesn't have an installation implementation
            config_data = obj.config if include_config else None
        else:
            try:
                # just doing this to avoid querying for an object we already have
                installation._org_integration = obj
                config_data = installation.get_config_data() if include_config else None
                dynamic_display_information = installation.get_dynamic_display_information()
            except ApiError as e:
                # If there is an ApiError from our 3rd party integration providers, assume there is an problem with the configuration and set it to disabled.
                integration.update({"status": "disabled"})
                name = "sentry.serializers.model.organizationintegration"
                log_info = {
                    "error": str(e),
                    "integration_id": obj.integration.id,
                    "integration_provider": obj.integration.provider,
                }
                logger.info(name, extra=log_info)

        integration.update({"configData": config_data})

        if dynamic_display_information:
            integration.update({"dynamicDisplayInformation": dynamic_display_information})

        return integration


class IntegrationProviderSerializer(Serializer):
    def serialize(self, obj, attrs, user, organization):
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
                url=f"/organizations/{organization.slug}/integrations/{obj.key}/setup/",
                **obj.setup_dialog_config,
            ),
        }


class IntegrationIssueConfigSerializer(IntegrationSerializer):
    def __init__(self, group, action, params=None):
        self.group = group
        self.action = action
        self.params = params

    def serialize(self, obj, attrs, user, organization_id=None):
        data = super().serialize(obj, attrs, user)
        installation = obj.get_installation(organization_id)

        if self.action == "link":
            config = installation.get_link_issue_config(self.group, params=self.params)
            data["linkIssueConfig"] = config

        if self.action == "create":
            config = installation.get_create_issue_config(self.group, user, params=self.params)
            data["createIssueConfig"] = config

        return data


class IntegrationIssueSerializer(IntegrationSerializer):
    def __init__(self, group):
        self.group = group

    def get_attrs(self, item_list, user, **kwargs):
        external_issues = ExternalIssue.objects.filter(
            id__in=GroupLink.objects.filter(
                group_id=self.group.id,
                project_id=self.group.project_id,
                linked_type=GroupLink.LinkedType.issue,
                relationship=GroupLink.Relationship.references,
            ).values_list("linked_id", flat=True),
            integration_id__in=[i.id for i in item_list],
        )

        issues_by_integration = defaultdict(list)
        ints_by_id = {i.id: i for i in item_list}
        for ei in external_issues:
            # TODO(jess): move into an external issue serializer?
            installation = ints_by_id[ei.integration_id].get_installation(
                self.group.organization.id
            )
            issues_by_integration[ei.integration_id].append(
                {
                    "id": str(ei.id),
                    "key": ei.key,
                    "url": installation.get_issue_url(ei.key),
                    "title": ei.title,
                    "description": ei.description,
                    "displayName": installation.get_issue_display_name(ei),
                }
            )

        return {
            item: {"external_issues": issues_by_integration.get(item.id, [])} for item in item_list
        }

    def serialize(self, obj, attrs, user):
        data = super().serialize(obj, attrs, user)
        data["externalIssues"] = attrs.get("external_issues", [])
        return data


@register(ExternalTeam)
class ExternalTeamSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        provider = ExternalTeam.get_provider_string(obj.provider)
        return {
            "id": str(obj.id),
            "teamId": str(obj.team_id),
            "provider": provider,
            "externalName": obj.external_name,
        }


@register(ExternalUser)
class ExternalUserSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        provider = ExternalUser.get_provider_string(obj.provider)
        return {
            "id": str(obj.id),
            "memberId": str(obj.organizationmember_id),
            "provider": provider,
            "externalName": obj.external_name,
        }
