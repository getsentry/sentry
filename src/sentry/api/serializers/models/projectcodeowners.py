import logging
from datetime import datetime
from typing import TypedDict

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.projectownership import (
    OwnershipRuleOwnerResponse,
    OwnershipRuleResponse,
    OwnershipSchemaResponse,
)
from sentry.api.validators.project_codeowners import CodeOwnersErrors, build_codeowners_associations
from sentry.integrations.api.serializers.models.repository_project_path_config import (
    RepositoryProjectPathConfigSerializer,
    RepositoryProjectPathConfigSerializerResponse,
)
from sentry.integrations.services.integration import integration_service
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.issues.ownership.grammar import OwnershipSchema, convert_schema_to_rules_text
from sentry.models.projectcodeowners import ProjectCodeOwners

logger = logging.getLogger(__name__)


def _serialize_ownership_schema(schema: OwnershipSchema) -> OwnershipSchemaResponse:
    serialized_rules: list[OwnershipRuleResponse] = []
    for rule in schema["rules"]:
        serialized_owners: list[OwnershipRuleOwnerResponse] = []
        for owner in rule["owners"]:
            serialized_owner: OwnershipRuleOwnerResponse = {
                "type": owner["type"],
                "name": owner["identifier"],
            }
            if "id" in owner:
                serialized_owner["id"] = str(owner["id"])
            serialized_owners.append(serialized_owner)

        serialized_rules.append(
            {
                "matcher": {
                    "type": rule["matcher"]["type"],
                    "pattern": rule["matcher"]["pattern"],
                },
                "owners": serialized_owners,
            }
        )

    return {"$version": schema["$version"], "rules": serialized_rules}


class EmptyOwnershipSchemaResponse(TypedDict):
    """Legacy CODEOWNERS records can have an empty schema before it is built."""


class ProjectCodeOwnersResponseOptional(TypedDict, total=False):
    codeMapping: RepositoryProjectPathConfigSerializerResponse
    ownershipSyntax: str
    errors: CodeOwnersErrors
    schema: OwnershipSchemaResponse | EmptyOwnershipSchemaResponse
    codeOwnersUrl: str


class ProjectCodeOwnersResponse(ProjectCodeOwnersResponseOptional):
    id: str
    raw: str
    dateCreated: datetime
    dateUpdated: datetime
    dateSynced: datetime | None
    codeMappingId: str
    provider: str


DEFAULT_CODEOWNERS_EXPAND = ("errors", "hasTargetingContext")


@register(ProjectCodeOwners)
class ProjectCodeOwnersSerializer(Serializer[ProjectCodeOwnersResponse]):
    def __init__(
        self,
        expand=None,
    ):
        self.expand = expand or []

    def get_attrs(self, item_list, user, **kwargs):
        attrs = {}
        integrations = {
            i.id: i
            for i in integration_service.get_integrations(
                integration_ids=[
                    item.repository_project_path_config.integration_id for item in item_list
                ]
            )
        }
        for item in item_list:
            code_mapping = item.repository_project_path_config
            repository = code_mapping.project_repository.repository

            integration = integrations.get(code_mapping.integration_id)
            provider = "unknown"
            codeowners_url = "unknown"
            if integration and code_mapping.organization_integration_id:
                provider = integration.provider
                try:
                    install = integration.get_installation(
                        organization_id=code_mapping.organization_id,
                    )
                    if isinstance(install, RepositoryIntegration):
                        codeowners_response = install.get_codeowner_file(
                            repository, ref=code_mapping.default_branch
                        )
                        if codeowners_response is not None:
                            codeowners_url = codeowners_response["html_url"]
                except Exception:
                    logger.exception("Could not get CODEOWNERS URL. Continuing execution.")

            attrs[item] = {
                "provider": provider,
                "codeMapping": code_mapping,
                "codeOwnersUrl": codeowners_url,
            }

        return attrs

    def serialize(self, obj, attrs, user, **kwargs) -> ProjectCodeOwnersResponse:
        data: ProjectCodeOwnersResponse = {
            "id": str(obj.id),
            "raw": obj.raw,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
            "dateSynced": obj.date_synced,
            "codeMappingId": str(obj.repository_project_path_config_id),
            "provider": attrs.get("provider", "unknown"),
        }

        if "codeMapping" in self.expand:
            data["codeMapping"] = serialize(
                attrs["codeMapping"],
                user=user,
                serializer=RepositoryProjectPathConfigSerializer(),
            )

        if "ownershipSyntax" in self.expand:
            data["ownershipSyntax"] = (
                convert_schema_to_rules_text(obj.schema)
                if obj.schema and "$version" in obj.schema
                else ""
            )

        if "errors" in self.expand:
            _, errors = build_codeowners_associations(obj.raw, obj.project)
            data["errors"] = errors

        if "hasTargetingContext" in self.expand:
            data["schema"] = _serialize_ownership_schema(obj.schema) if obj.schema else obj.schema
            data["codeOwnersUrl"] = attrs.get("codeOwnersUrl", "unknown")

        return data
