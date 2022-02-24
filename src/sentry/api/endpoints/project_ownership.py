from django.utils import timezone
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import ProjectOwnership
from sentry.ownership.grammar import CODEOWNERS, create_schema_from_issue_owners
from sentry.signals import ownership_rule_created

MAX_RAW_LENGTH = 100_000
HIGHER_MAX_RAW_LENGTH = 200_000


class ProjectOwnershipSerializer(serializers.Serializer):
    raw = serializers.CharField(allow_blank=True)
    fallthrough = serializers.BooleanField()
    autoAssignment = serializers.BooleanField()
    codeownersAutoSync = serializers.BooleanField(default=True)

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

        schema = create_schema_from_issue_owners(attrs["raw"], self.context["ownership"].project_id)

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

        changed = ownership.auto_assignment != auto_assignment

        if changed:
            ownership.auto_assignment = auto_assignment

        return changed


class ProjectOwnershipMixin:
    def get_ownership(self, project):
        try:
            return ProjectOwnership.objects.get(project=project)
        except ProjectOwnership.DoesNotExist:
            return ProjectOwnership(
                project=project,
                date_created=None,
                last_updated=None,
            )


class ProjectOwnershipEndpoint(ProjectEndpoint, ProjectOwnershipMixin):
    def get(self, request: Request, project) -> Response:
        """
        Retrieve a Project's Ownership configuration
        ````````````````````````````````````````````

        Return details on a project's ownership configuration.

        :auth: required
        """
        return Response(serialize(self.get_ownership(project), request.user))

    def put(self, request: Request, project) -> Response:
        """
        Update a Project's Ownership configuration
        ``````````````````````````````````````````

        Updates a project's ownership configuration settings. Only the
        attributes submitted are modified.

        :param string raw: Raw input for ownership configuration.
        :param boolean fallthrough: Indicate if there is no match on explicit rules,
                                    to fall through and make everyone an implicit owner.
        :auth: required
        """
        serializer = ProjectOwnershipSerializer(
            data=request.data, partial=True, context={"ownership": self.get_ownership(project)}
        )
        if serializer.is_valid():
            ownership = serializer.save()
            ownership_rule_created.send_robust(project=project, sender=self.__class__)
            return Response(serialize(ownership, request.user))
        return Response(serializer.errors, status=400)
