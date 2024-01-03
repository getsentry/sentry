from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectOwnershipPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.projectownership import ProjectOwnershipSerializer
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST
from sentry.apidocs.examples import ownership_examples
from sentry.apidocs.parameters import GlobalParams
from sentry.models.groupowner import GroupOwner
from sentry.models.project import Project
from sentry.models.projectownership import ProjectOwnership
from sentry.ownership.grammar import CODEOWNERS, create_schema_from_issue_owners
from sentry.signals import ownership_rule_created
from sentry.utils.audit import create_audit_entry

MAX_RAW_LENGTH = 100_000
HIGHER_MAX_RAW_LENGTH = 250_000


class ProjectOwnershipRequestSerializer(serializers.Serializer):
    raw = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Raw input for ownership configuration. See the [Ownership Rules Documentation](/product/issues/ownership-rules/) to learn more.",
    )
    fallthrough = serializers.BooleanField(
        required=False,
        help_text="A boolean determining who to assign ownership to when an ownership rule has no match. If set to `True`, all project members are made owners. Otherwise, no owners are set.",
    )
    autoAssignment = serializers.CharField(
        required=False,
        allow_blank=False,
        help_text="""Auto-assignment settings. The available options are:
- Auto Assign to Issue Owner
- Auto Assign to Suspect Commits
- Turn off Auto-Assignment""",
    )
    codeownersAutoSync = serializers.BooleanField(
        required=False,
        default=True,
        help_text="Set to `True` to sync issue owners with CODEOWNERS updates in a release.",
    )

    @staticmethod
    def _validate_no_codeowners(rules):
        """
        codeowner matcher types cannot be added via ProjectOwnership, only through codeowner
        specific serializers
        """
        for rule in rules:
            if rule["matcher"]["type"] == CODEOWNERS:
                raise serializers.ValidationError(
                    {"raw": "Codeowner type paths can only be added by importing CODEOWNER files"}
                )

    def get_max_length(self):
        if features.has(
            "organizations:higher-ownership-limit", self.context["ownership"].project.organization
        ):
            return HIGHER_MAX_RAW_LENGTH
        return MAX_RAW_LENGTH

    def validate_autoAssignment(self, value):
        if value not in [
            "Auto Assign to Suspect Commits",
            "Auto Assign to Issue Owner",
            "Turn off Auto-Assignment",
        ]:
            raise serializers.ValidationError({"autoAssignment": "Invalid selection."})
        return value

    def validate(self, attrs):
        if "raw" not in attrs:
            return attrs

        # We want to limit `raw` to a reasonable length, so that people don't end up with values
        # that are several megabytes large. To not break this functionality for existing customers
        # we temporarily allow rows that already exceed this limit to still be updated.
        existing_raw = self.context["ownership"].raw or ""
        max_length = self.get_max_length()
        if len(attrs["raw"]) > max_length and len(existing_raw) <= max_length:
            raise serializers.ValidationError(
                {"raw": f"Raw needs to be <= {max_length} characters in length"}
            )

        if features.has(
            "organizations:streamline-targeting-context",
            self.context["ownership"].project.organization,
        ):
            schema = create_schema_from_issue_owners(
                attrs["raw"], self.context["ownership"].project_id, add_owner_ids=True
            )
        else:
            schema = create_schema_from_issue_owners(
                attrs["raw"], self.context["ownership"].project_id
            )

        self._validate_no_codeowners(schema["rules"])

        attrs["schema"] = schema
        return attrs

    def save(self):
        ownership = self.context["ownership"]

        changed = False
        if "raw" in self.validated_data:
            raw = self.validated_data["raw"]
            if not raw.strip():
                raw = None

            if ownership.raw != raw:
                ownership.raw = raw
                ownership.schema = self.validated_data.get("schema")
                changed = True

        if "fallthrough" in self.validated_data:
            fallthrough = self.validated_data["fallthrough"]
            if ownership.fallthrough != fallthrough:
                ownership.fallthrough = fallthrough
                changed = True

        if "codeownersAutoSync" in self.validated_data:
            codeowners_auto_sync = self.validated_data["codeownersAutoSync"]
            if ownership.codeowners_auto_sync != codeowners_auto_sync:
                ownership.codeowners_auto_sync = codeowners_auto_sync
                changed = True

        changed = self.__modify_auto_assignment(ownership) or changed

        if changed:
            now = timezone.now()
            if ownership.date_created is None:
                ownership.date_created = now
            ownership.last_updated = now
            ownership.save()

        return ownership

    def __modify_auto_assignment(self, ownership):
        auto_assignment = self.validated_data.get("autoAssignment")

        if auto_assignment is None:
            return False

        new_values = {}
        if auto_assignment == "Auto Assign to Suspect Commits":
            new_values["auto_assignment"] = True
            new_values["suspect_committer_auto_assignment"] = True
        if auto_assignment == "Auto Assign to Issue Owner":
            new_values["auto_assignment"] = True
            new_values["suspect_committer_auto_assignment"] = False
        if auto_assignment == "Turn off Auto-Assignment":
            autoassignment_types = ProjectOwnership._get_autoassignment_types(ownership)
            if autoassignment_types:
                GroupOwner.invalidate_autoassigned_owner_cache(
                    ownership.project_id, autoassignment_types
                )
            new_values["auto_assignment"] = False
            new_values["suspect_committer_auto_assignment"] = False

        changed = (
            ownership.auto_assignment != new_values["auto_assignment"]
            or ownership.suspect_committer_auto_assignment
            != new_values["suspect_committer_auto_assignment"]
        )

        if changed:
            ownership.auto_assignment = new_values["auto_assignment"]
            ownership.suspect_committer_auto_assignment = new_values[
                "suspect_committer_auto_assignment"
            ]
        return changed


@region_silo_endpoint
@extend_schema(tags=["Projects"])
class ProjectOwnershipEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (ProjectOwnershipPermission,)

    def get_ownership(self, project):
        try:
            return ProjectOwnership.objects.get(project=project)
        except ProjectOwnership.DoesNotExist:
            return ProjectOwnership(
                project=project,
                date_created=None,
                last_updated=None,
            )

    def add_owner_id_to_schema(self, ownership: ProjectOwnership, project: Project) -> None:
        if not hasattr(ownership, "schema") or (
            ownership.schema
            and ownership.schema.get("rules")
            and "id" not in ownership.schema["rules"][0]["owners"][0].keys()
        ):
            ownership.schema = create_schema_from_issue_owners(
                ownership.raw, project.id, add_owner_ids=True, remove_deleted_owners=True
            )
            ownership.save()

    def rename_schema_identifier_for_parsing(self, ownership: ProjectOwnership) -> None:
        """
        Rename the attribute "identifier" to "name" in the schema response so that it can be parsed
        in the frontend

        `ownership`: The ownership containing the schema with the rules that will be renamed
        """
        if hasattr(ownership, "schema") and ownership.schema and ownership.schema.get("rules"):
            for rule in ownership.schema["rules"]:
                for rule_owner in rule["owners"]:
                    rule_owner["name"] = rule_owner.pop("identifier")

    @extend_schema(
        operation_id="Retrieve Ownership Configuration for a Project",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
        ],
        request=None,
        responses={200: ProjectOwnershipSerializer},
        examples=ownership_examples.GET_PROJECT_OWNERSHIP,
    )
    def get(self, request: Request, project) -> Response:
        """
        Returns details on a project's ownership configuration.
        """
        ownership = self.get_ownership(project)
        should_return_schema = features.has(
            "organizations:streamline-targeting-context", project.organization
        )

        if should_return_schema and ownership:
            self.add_owner_id_to_schema(ownership, project)
            self.rename_schema_identifier_for_parsing(ownership)

        return Response(
            serialize(ownership, request.user, should_return_schema=should_return_schema)
        )

    @extend_schema(
        operation_id="Update Ownership Configuration for a Project",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
        ],
        request=ProjectOwnershipRequestSerializer,
        responses={
            202: ProjectOwnershipSerializer,
            400: RESPONSE_BAD_REQUEST,
        },
        examples=ownership_examples.UPDATE_PROJECT_OWNERSHIP,
    )
    def put(self, request: Request, project) -> Response:
        """
        Updates ownership configurations for a project. Note that only the
        attributes submitted are modified.
        """

        # Ownership settings others than "raw" ownership rules can only be updated by
        # users with the organization-level owner, manager, or team-level admin roles
        has_project_write = request.access and (
            request.access.has_scope("project:write")
            or request.access.has_project_scope(project, "project:write")
        )
        if list(request.data) != ["raw"] and not has_project_write:
            raise PermissionDenied

        should_return_schema = features.has(
            "organizations:streamline-targeting-context", project.organization
        )
        serializer = ProjectOwnershipRequestSerializer(
            data=request.data, partial=True, context={"ownership": self.get_ownership(project)}
        )
        if serializer.is_valid():
            ownership = serializer.save()

            change_data = {**serializer.validated_data}
            # Ownership rules can be large (3 MB) and we don't want to store them in the audit log
            if "raw" in change_data and "schema" in change_data:
                del change_data["schema"]
                del change_data["raw"]
                change_data["ownership_rules"] = "modified"

            create_audit_entry(
                request=self.request,
                actor=request.user,
                organization=project.organization,
                target_object=project.id,
                event=audit_log.get_event_id("PROJECT_OWNERSHIPRULE_EDIT"),
                data={**change_data, **project.get_audit_log_data()},
            )
            ownership_rule_created.send_robust(project=project, sender=self.__class__)
            return Response(
                serialize(ownership, request.user, should_return_schema=should_return_schema)
            )
        return Response(serializer.errors, status=400)
