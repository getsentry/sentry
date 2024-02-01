from typing import Any, Mapping

from rest_framework import serializers

from sentry.models.commit import Commit
from sentry.models.repository import Repository


class InCommitValidator(serializers.Serializer):
    commit = serializers.CharField(required=True)
    repository = serializers.CharField(required=True)

    def validate_repository(self, value: str) -> Repository:
        project = self.context["project"]
        try:
            return Repository.objects.get(organization_id=project.organization_id, name=value)
        except Repository.DoesNotExist:
            raise serializers.ValidationError("Unable to find the given repository.")

    def validate(self, attrs: Mapping[str, Any]) -> Commit:
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
