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

    def validate_repository(self, value: str) -> Repository | list[Repository]:
        project = self.context["project"]
        repos = list(
            Repository.objects.filter(organization_id=project.organization_id, name=value)
        )
        if not repos:
            raise serializers.ValidationError("Unable to find the given repository.")
        if len(repos) == 1:
            return repos[0]
        # Multiple repos share this name (e.g. same repo connected via different providers).
        # Return the full list and let validate() disambiguate using the commit SHA.
        return repos

    def validate(self, attrs: dict[str, Any]) -> Commit:
        attrs = super().validate(attrs)
        repository = attrs.get("repository")
        commit_key = attrs.get("commit")
        if not repository:
            raise serializers.ValidationError(
                {"repository": ["Unable to find the given repository."]}
            )
        if not commit_key:
            raise serializers.ValidationError({"commit": ["Unable to find the given commit."]})

        # When multiple repos share the same name, use the commit SHA to identify the right one.
        if isinstance(repository, list):
            repo_ids = [r.id for r in repository]
            matching_commits = list(
                Commit.objects.filter(repository_id__in=repo_ids, key=commit_key)
            )
            if not matching_commits:
                raise serializers.ValidationError({"commit": ["Unable to find the given commit."]})
            if len(matching_commits) > 1:
                raise serializers.ValidationError(
                    {
                        "repository": [
                            "Multiple repositories match the given name. "
                            "Please specify the repository more precisely."
                        ]
                    }
                )
            return matching_commits[0]

        try:
            commit = Commit.objects.get(repository_id=repository.id, key=commit_key)
        except Commit.DoesNotExist:
            raise serializers.ValidationError({"commit": ["Unable to find the given commit."]})
        return commit
