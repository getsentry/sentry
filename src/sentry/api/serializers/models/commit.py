from collections import defaultdict
from collections.abc import Mapping
from datetime import datetime
from typing import NotRequired, TypedDict

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.pullrequest import PullRequestSerializerResponse
from sentry.api.serializers.models.release import Author, get_users_for_authors
from sentry.api.serializers.models.repository import RepositorySerializerResponse
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository


class CommitSerializerResponse(TypedDict):
    id: str
    message: str | None
    dateCreated: datetime
    pullRequest: PullRequestSerializerResponse | None
    suspectCommitType: str

    repository: NotRequired[RepositorySerializerResponse]
    author: NotRequired[Author]


class CommitReleaseSerializerResponse(TypedDict):
    version: str
    shortVersion: str
    ref: str
    url: str
    dateReleased: datetime
    dateCreated: datetime


class CommitSerializerResponseWithReleases(CommitSerializerResponse):
    releases: list[CommitReleaseSerializerResponse]


def get_users_for_commits(item_list, user=None) -> Mapping[str, Author]:
    authors = list(
        CommitAuthor.objects.get_many_from_cache([i.author_id for i in item_list if i.author_id])
    )

    if authors:
        org_ids = {item.organization_id for item in item_list}
        if len(org_ids) == 1:
            return get_users_for_authors(organization_id=org_ids.pop(), authors=authors, user=user)
    return {}


@register(Commit)
class CommitSerializer(Serializer):
    def __init__(self, exclude=None, include=None, type=None, *args, **kwargs):
        Serializer.__init__(self, *args, **kwargs)
        self.exclude = frozenset(exclude if exclude else ())
        self.type = type or ""

    def get_attrs(self, item_list, user, **kwargs):
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

    def serialize(self, obj: Commit, attrs, user, **kwargs) -> CommitSerializerResponse:
        d: CommitSerializerResponse = {
            "id": obj.key,
            "message": obj.message,
            "dateCreated": obj.date_added,
            "pullRequest": attrs["pull_request"],
            "suspectCommitType": attrs["suspect_commit_type"],
        }
        if "repository" not in self.exclude:
            d["repository"] = attrs["repository"]
        if "author" not in self.exclude:
            d["author"] = attrs["user"]
        return d


@register(Commit)
class CommitWithReleaseSerializer(CommitSerializer):
    def __init__(self, exclude=None, include=None, type=None, *args, **kwargs):
        Serializer.__init__(self, *args, **kwargs)
        self.exclude = frozenset(exclude if exclude else ())
        self.type = type or ""

    def get_attrs(self, item_list, user, **kwargs):
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

    def serialize(self, obj, attrs, user, **kwargs) -> CommitSerializerResponseWithReleases:
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
                for r in attrs["releases"]
            ],
        }
        if "repository" in data:
            ret["repository"] = attrs["repository"]
        if "author" in data:
            ret["author"] = attrs["user"]

        return ret
