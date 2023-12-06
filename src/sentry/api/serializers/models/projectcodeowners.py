import logging
from typing import Any, Dict

# from sentry.api.endpoints.project_ownership import rename_schema_identifier_for_parsing
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.repository_project_path_config import (
    RepositoryProjectPathConfigSerializer,
)
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.ownership.grammar import convert_schema_to_rules_text
from sentry.services.hybrid_cloud.integration import integration_service

logger = logging.getLogger(__name__)


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

            integration = integrations[item.repository_project_path_config.integration_id]
            install = integration.get_installation(
                organization_id=item.repository_project_path_config.organization_id,
            )
            codeowners_url = "unknown"
            if item.repository_project_path_config.organization_integration_id:
                try:
                    codeowners_url = install.get_codeowner_file(
                        code_mapping.repository, ref=code_mapping.default_branch
                    )["html_url"]

                except Exception:
                    logger.exception("Could not get CODEOWNERS URL. Continuing execution.")

            attrs[item] = {
                "provider": integration.provider
                if item.repository_project_path_config.organization_integration_id
                else "unknown",
                "codeMapping": code_mapping,
                "codeOwnersUrl": codeowners_url,
            }

        return attrs

    def rename_schema_identifier_for_parsing(self, schema: Dict[str, Any]) -> None:
        """
        Rename the attribute "identifier" to "name" in the schema response so that it can be parsed
        in the frontend

        `schema`: The schema containing the rules that will be renamed
        """
        if schema.get("rules"):
            for rule in schema["rules"]:
                for rule_owner in rule["owners"]:
                    rule_owner["name"] = rule_owner.pop("identifier")

    def serialize(self, obj, attrs, user):
        from sentry.api.validators.project_codeowners import validate_codeowners_associations

        data = {
            "id": str(obj.id),
            "raw": obj.raw,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
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
            _, errors = validate_codeowners_associations(obj.raw, obj.project)
            data["errors"] = errors

        if "renameIdentifier" in self.expand and hasattr(obj, "schema") and obj.schema:
            self.rename_schema_identifier_for_parsing(obj.schema)

        if "hasTargetingContext" in self.expand:
            data["schema"] = obj.schema
            data["codeOwnersUrl"] = attrs.get("codeOwnersUrl", "unknown")

        return data
