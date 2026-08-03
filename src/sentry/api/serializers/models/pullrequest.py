from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Literal, TypedDict

from django.db.models import Prefetch, prefetch_related_objects

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.release import get_users_for_authors
from sentry.api.serializers.models.repository import RepositorySerializerResponse
from sentry.api.serializers.release_details_types import Author
from sentry.models.commitauthor import CommitAuthor
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestAttribution,
    PullRequestLifecycleState,
)
from sentry.models.repository import Repository
from sentry.pr_metrics.attribution import is_seer_attribution

PullRequestStatus = Literal["merged", "open", "closed", "draft", "unknown"]


def get_stored_pull_request_status(pull_request: PullRequest) -> PullRequestStatus | None:
    if pull_request.state == PullRequestLifecycleState.MERGED:
        return "merged"
    if pull_request.state == PullRequestLifecycleState.CLOSED:
        return "closed"
    if pull_request.draft is True:
        return "draft"
    # `draft` is nullable for older rows, so only trust `open` when we know the PR
    # is not a draft.
    if pull_request.state == PullRequestLifecycleState.OPEN and pull_request.draft is False:
        return "open"
    return None


class PullRequestSerializerResponse(TypedDict):
    id: str
    title: str | None
    message: str | None
    dateCreated: datetime
    mergedAt: datetime | None
    status: PullRequestStatus | None
    repository: RepositorySerializerResponse
    author: Author
    externalUrl: str


class LinkedPullRequestSeerAttributionResponse(TypedDict):
    type: Literal["seer"]
    id: Literal["seer"]


LinkedPullRequestAttributionResponse = LinkedPullRequestSeerAttributionResponse


class LinkedPullRequestResponse(PullRequestSerializerResponse):
    attribution: LinkedPullRequestAttributionResponse | None
    dateLinked: datetime


def get_users_for_pull_requests(item_list, user=None):
    authors = list(
        CommitAuthor.objects.filter(id__in=[i.author_id for i in item_list if i.author_id])
    )

    if authors:
        org_ids = {item.organization_id for item in item_list}
        if len(org_ids) == 1:
            return get_users_for_authors(organization_id=org_ids.pop(), authors=authors, user=user)
    return {}


@register(PullRequest)
class PullRequestSerializer(Serializer[PullRequestSerializerResponse]):
    def get_attrs(self, item_list, user, **kwargs):
        users_by_author = get_users_for_pull_requests(item_list, user)
        repositories = list(Repository.objects.filter(id__in=[c.repository_id for c in item_list]))
        repository_map = {repository.id: repository for repository in repositories}
        serialized_repos = {r["id"]: r for r in serialize(repositories, user)}

        result = {}
        for item in item_list:
            repository_id = str(item.repository_id)
            external_url = ""
            if item.repository_id in repository_map:
                external_url = item.get_external_url()
            result[item] = {
                "repository": serialized_repos.get(repository_id, {}),
                "external_url": external_url,
                "user": users_by_author.get(str(item.author_id), {}) if item.author_id else {},
            }

        return result

    def serialize(self, obj: PullRequest, attrs, user, **kwargs) -> PullRequestSerializerResponse:
        return {
            "id": obj.key,
            "title": obj.title,
            "message": obj.message,
            "dateCreated": obj.date_added,
            "mergedAt": obj.merged_at,
            "status": get_stored_pull_request_status(obj),
            "repository": attrs["repository"],
            "author": attrs["user"],
            "externalUrl": attrs["external_url"],
        }


def _serialize_attribution(
    attributions: Sequence[PullRequestAttribution],
) -> LinkedPullRequestAttributionResponse | None:
    if not any(is_seer_attribution(attribution) for attribution in attributions):
        return None

    return {
        "type": "seer",
        "id": "seer",
    }


class LinkedPullRequestSerializer(PullRequestSerializer):
    """Serialize a pull request linked to a group.

    The caller passes in the linked-at timestamp and PR status; this serializer
    maps them, along with the PR's Seer attribution, into the response shape.
    """

    def __init__(
        self,
        *,
        date_linked_by_pr_id: Mapping[int, datetime],
        status_by_pr_id: Mapping[int, PullRequestStatus],
    ) -> None:
        self.date_linked_by_pr_id = date_linked_by_pr_id
        self.status_by_pr_id = status_by_pr_id

    def get_attrs(self, item_list, user, **kwargs):
        attrs = super().get_attrs(item_list, user)
        prefetch_related_objects(
            item_list,
            Prefetch(
                "pullrequestattribution_set",
                queryset=PullRequestAttribution.objects.filter(is_valid=True),
                to_attr="valid_attributions",
            ),
        )
        for item in item_list:
            attrs[item]["attribution"] = _serialize_attribution(item.valid_attributions)
        return attrs

    def serialize(self, obj: PullRequest, attrs, user, **kwargs) -> LinkedPullRequestResponse:
        return {
            **super().serialize(obj, attrs, user, **kwargs),
            "attribution": attrs["attribution"],
            "dateLinked": self.date_linked_by_pr_id[obj.id],
            "status": self.status_by_pr_id[obj.id],
        }
