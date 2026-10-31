from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import TypedDict, cast

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.api.serializers.models.commit import EmptyAuthor, get_users_for_commits
from sentry.api.serializers.release_details_types import Author
from sentry.models.commit import Commit
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.repository import Repository
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class CommitFileChangeSerializerResponse(TypedDict):
    id: str
    orgId: int
    author: Author | EmptyAuthor
    commitMessage: str | None
    filename: str
    type: str
    repoName: str | None


@register(CommitFileChange)
class CommitFileChangeSerializer(Serializer[CommitFileChangeSerializerResponse]):
    def get_attrs(
        self,
        item_list: Sequence[CommitFileChange],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[CommitFileChange, dict[str, object]]:
        commits = list(
            Commit.objects.filter(id__in=[f.commit_id for f in item_list]).select_related("author")
        )
        users_by_author = get_users_for_commits(commits)
        commits_by_id = {commit.id: commit for commit in commits}

        repo_names_by_id = dict(
            Repository.objects.filter(
                id__in=[commit.repository_id for commit in commits]
            ).values_list("id", "name")
        )

        result: dict[CommitFileChange, dict[str, object]] = {}
        for item in item_list:
            commit = commits_by_id[item.commit_id]
            result[item] = {
                "user": users_by_author.get(str(commit.author_id), {}) if commit.author_id else {},
                "message": commit.message,
                "repository_name": repo_names_by_id.get(commit.repository_id),
            }

        return result

    def serialize(
        self,
        obj: CommitFileChange,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> CommitFileChangeSerializerResponse:
        data: CommitFileChangeSerializerResponse = {
            "id": str(obj.id),
            "orgId": obj.organization_id,
            "author": cast(Author | EmptyAuthor, attrs.get("user", {})),
            "commitMessage": cast(str | None, attrs.get("message", "")),
            "filename": obj.filename,
            "type": obj.type,
            "repoName": cast(str | None, attrs.get("repository_name", "")),
        }
        return data
