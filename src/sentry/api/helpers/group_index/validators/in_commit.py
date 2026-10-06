from typing import Any, TypedDict

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

        project = self.context["project"]
        repositories = Repository.objects.filter(
            organization_id=project.organization_id, name=repository
        )
        if not repositories.exists():
            raise serializers.ValidationError(
                {"repository": ["Unable to find the given repository."]}
            )

        try:
            return Commit.objects.get(
                repository_id__in=repositories.values("id"),
                key=commit,
            )
        except Commit.DoesNotExist:
            raise serializers.ValidationError({"commit": ["Unable to find the given commit."]})
        except Commit.MultipleObjectsReturned:
            raise serializers.ValidationError(
                {"commit": ["Multiple repositories contain the given commit."]}
            )
