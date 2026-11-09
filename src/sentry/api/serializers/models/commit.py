from collections import defaultdict
from collections.abc import Collection, Mapping, Sequence
from datetime import datetime
from typing import Annotated, NotRequired, TypedDict, cast

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.pullrequest import PullRequestSerializerResponse
from sentry.api.serializers.models.release import get_users_for_authors
from sentry.api.serializers.models.repository import RepositorySerializerResponse
from sentry.api.serializers.release_details_types import Author, EmptyAuthor
from sentry.apidocs.descriptions import ApiDescription
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.pullrequest import PullRequest
from sentry.models.release import Release
from sentry.models.repository import Repository
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class CommitSerializerResponse(TypedDict):
    id: Annotated[str, ApiDescription("Commit SHA")]
    message: Annotated[str | None, ApiDescription("Commit message")]
    dateCreated: Annotated[datetime, ApiDescription("When the commit was made (ISO 8601)")]
    pullRequest: Annotated[
        PullRequestSerializerResponse | None, ApiDescription("Pull request the commit belongs to")
    ]
    suspectCommitType: Annotated[
        str,
        ApiDescription(
            "How the commit was found as a suspect commit: via commit in release or via SCM integration. Empty for other commits"
        ),
    ]

    repository: NotRequired[
        Annotated[RepositorySerializerResponse, ApiDescription("Repository the commit belongs to")]
    ]
    author: NotRequired[
        Annotated[
            Author | EmptyAuthor,
            ApiDescription(
                "Author of the commit: a Sentry user when the email matches one, otherwise the name and email from the commit"
            ),
        ]
    ]


class CommitReleaseSerializerResponse(TypedDict):
    version: Annotated[str, ApiDescription("Version of the release")]
    shortVersion: Annotated[str, ApiDescription("Short version of the release")]
    ref: Annotated[str | None, ApiDescription("Commit ref of the release")]
    url: Annotated[str | None, ApiDescription("URL of the release")]
    dateReleased: Annotated[
        datetime | None, ApiDescription("When the release was released (ISO 8601)")
    ]
    dateCreated: Annotated[datetime, ApiDescription("When the release was created (ISO 8601)")]


class CommitSerializerResponseWithReleases(CommitSerializerResponse):
    releases: Annotated[
        list[CommitReleaseSerializerResponse], ApiDescription("Releases that contain the commit")
    ]


def get_users_for_commits(
    item_list: Sequence[Commit], user: User | RpcUser | AnonymousUser | None = None
) -> Mapping[str, Author]:
    authors = list(
        CommitAuthor.objects.get_many_from_cache([i.author_id for i in item_list if i.author_id])
    )

    if authors:
        org_ids = {item.organization_id for item in item_list}
        if len(org_ids) == 1:
            return get_users_for_authors(organization_id=org_ids.pop(), authors=authors, user=user)
    return {}


@register(Commit)
class CommitSerializer(Serializer[CommitSerializerResponse]):
    def __init__(
        self,
        exclude: Collection[str] | None = None,
        include: Collection[str] | None = None,
        type: str | None = None,
        *args: object,
        **kwargs: object,
    ) -> None:
        Serializer.__init__(self, *args, **kwargs)
        self.exclude = frozenset(exclude if exclude else ())
        self.type = type or ""

    def get_attrs(
        self,
        item_list: Sequence[Commit],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[Commit, dict[str, object]]:
        if "author" not in self.exclude:
            users_by_author = get_users_for_commits(item_list, user)
        else:
            users_by_author = {}

        if "repository" not in self.exclude:
            repositories = serialize(
                list(Repository.objects.filter(id__in=[c.repository_id for c in item_list])), user
            )
        else:
            repositories = []

        repository_objs = {repository["id"]: repository for repository in repositories}

        pull_requests = list(
            PullRequest.objects.filter(
                merge_commit_sha__in=[c.key for c in item_list],
                organization_id=item_list[0].organization_id,
            )
        )

        pull_request_by_commit = {
            pr.merge_commit_sha: serialized_pr
            for (pr, serialized_pr) in zip(pull_requests, serialize(pull_requests))
        }

        result = {}
        for item in item_list:
            result[item] = {
                "repository": repository_objs.get(str(item.repository_id), {}),
                "user": users_by_author.get(str(item.author_id), {}) if item.author_id else {},
                "pull_request": pull_request_by_commit.get(item.key, None),
                "suspect_commit_type": self.type,
            }

        return result

    def serialize(
        self,
        obj: Commit,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> CommitSerializerResponse:
        d: CommitSerializerResponse = {
            "id": obj.key,
            "message": obj.message,
            "dateCreated": obj.date_added,
            "pullRequest": cast(PullRequestSerializerResponse | None, attrs["pull_request"]),
            "suspectCommitType": cast(str, attrs["suspect_commit_type"]),
        }
        if "repository" not in self.exclude:
            d["repository"] = cast(RepositorySerializerResponse, attrs["repository"])
        if "author" not in self.exclude:
            d["author"] = cast(Author | EmptyAuthor, attrs["user"])
        return d


@register(Commit)
class CommitWithReleaseSerializer(CommitSerializer):
    def __init__(
        self,
        exclude: Collection[str] | None = None,
        include: Collection[str] | None = None,
        type: str | None = None,
        *args: object,
        **kwargs: object,
    ) -> None:
        Serializer.__init__(self, *args, **kwargs)
        self.exclude = frozenset(exclude if exclude else ())
        self.type = type or ""

    def get_attrs(
        self,
        item_list: Sequence[Commit],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[Commit, dict[str, object]]:
        from sentry.models.releasecommit import ReleaseCommit

        attrs = super().get_attrs(item_list, user)
        releases_by_commit = defaultdict(list)
        queryset = ReleaseCommit.objects.filter(commit__in=item_list).select_related("release")[
            :1000
        ]
        for row in queryset:
            releases_by_commit[row.commit_id].append(row.release)
        for item in item_list:
            attrs[item]["releases"] = releases_by_commit[item.id]
        return attrs

    def serialize(
        self,
        obj: Commit,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> CommitSerializerResponseWithReleases:
        data = super().serialize(obj, attrs, user)
        ret: CommitSerializerResponseWithReleases = {
            "id": data["id"],
            "message": data["message"],
            "dateCreated": data["dateCreated"],
            "pullRequest": data["pullRequest"],
            "suspectCommitType": data["suspectCommitType"],
            "releases": [
                {
                    "version": r.version,
                    "shortVersion": r.version,
                    "ref": r.ref,
                    "url": r.url,
                    "dateReleased": r.date_released,
                    "dateCreated": r.date_added,
                }
                for r in cast(Sequence[Release], attrs["releases"])
            ],
        }
        if "repository" in data:
            ret["repository"] = cast(RepositorySerializerResponse, attrs["repository"])
        if "author" in data:
            ret["author"] = cast(Author | EmptyAuthor, attrs["user"])

        return ret
