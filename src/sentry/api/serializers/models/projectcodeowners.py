import logging

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.projectownership import (
    OwnershipRuleOwnerResponse,
    OwnershipRuleResponse,
    OwnershipSchemaResponse,
)
from sentry.integrations.api.serializers.models.repository_project_path_config import (
    RepositoryProjectPathConfigSerializer,
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


@register(ProjectCodeOwners)
class ProjectCodeOwnersSerializer(Serializer):
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
                integration_ids=[i.repository_project_path_config.integration_id for i in item_list]
            )
        }
        for item in item_list:
            code_mapping = item.repository_project_path_config
            repository = code_mapping.project_repository.repository

            integration = integrations[item.repository_project_path_config.integration_id]
            install = integration.get_installation(
                organization_id=item.repository_project_path_config.organization_id,
            )
            codeowners_url = "unknown"
            if item.repository_project_path_config.organization_integration_id and (
                isinstance(install, RepositoryIntegration)
            ):
                try:
                    codeowners_response = install.get_codeowner_file(
                        repository, ref=code_mapping.default_branch
                    )
                    if codeowners_response is not None:
                        codeowners_url = codeowners_response["html_url"]

                except Exception:
                    logger.exception("Could not get CODEOWNERS URL. Continuing execution.")

            attrs[item] = {
                "provider": (
                    integration.provider
                    if item.repository_project_path_config.organization_integration_id
                    else "unknown"
                ),
                "codeMapping": code_mapping,
                "codeOwnersUrl": codeowners_url,
            }

        return attrs

    def serialize(self, obj, attrs, user, **kwargs):
        from sentry.api.validators.project_codeowners import build_codeowners_associations

        data = {
            "id": str(obj.id),
            "raw": obj.raw,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
            "dateSynced": obj.date_synced,
            "codeMappingId": str(obj.repository_project_path_config_id),
            "provider": attrs.get("provider", "unknown"),
        }

        if "codeMapping" in self.expand:
            config = attrs.get("codeMapping", {})
            data["codeMapping"] = serialize(
                config, user=user, serializer=RepositoryProjectPathConfigSerializer()
            )

        if "ownershipSyntax" in self.expand:
            data["ownershipSyntax"] = convert_schema_to_rules_text(obj.schema)

        if "errors" in self.expand:
            _, errors = build_codeowners_associations(obj.raw, obj.project)
            data["errors"] = errors

        if "hasTargetingContext" in self.expand:
            data["schema"] = _serialize_ownership_schema(obj.schema) if obj.schema else obj.schema
            data["codeOwnersUrl"] = attrs.get("codeOwnersUrl", "unknown")

        return data
