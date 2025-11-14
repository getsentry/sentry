from typing import Any, TypedDict, int

from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from sentry.models.commit import Commit
from sentry.models.repository import Repository


class InCommitResult(TypedDict):
    commit: str
    repository: str


@extend_schema_serializer()
class InCommitValidator(serializers.Serializer[InCommitResult]):
    commit = serializers.CharField(required=True, help_text="The SHA of the resolving commit.")
    repository = serializers.CharField(
        required=True, help_text="The name of the repository (as it appears in Sentry)."
    )

    def validate_repository(self, value: str) -> Repository:
        project = self.context["project"]
        try:
            return Repository.objects.get(organization_id=project.organization_id, name=value)
        except Repository.DoesNotExist:
            raise serializers.ValidationError("Unable to find the given repository.")

    def validate(self, attrs: dict[str, Any]) -> Commit:
        attrs = super().validate(attrs)
        repository = attrs.get("repository")
        commit = attrs.get("commit")
        if not repository:
            raise serializers.ValidationError(
                {"repository": ["Unable to find the given repository."]}
            )
        if not commit:
            raise serializers.ValidationError({"commit": ["Unable to find the given commit."]})
        try:
            commit = Commit.objects.get(repository_id=repository.id, key=commit)
        except Commit.DoesNotExist:
            raise serializers.ValidationError({"commit": ["Unable to find the given commit."]})
        return commit
