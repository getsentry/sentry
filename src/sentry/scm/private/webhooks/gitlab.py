from typing import Literal

import msgspec
from scm.types import PullRequestAction

from sentry.scm.types import EventType, PullRequestEvent, SubscriptionEvent


class GitLabPullRequestUser(msgspec.Struct, gc=False):
    id: int
    username: str


class GitLabPullRequestProject(msgspec.Struct, gc=False):
    id: int
    visibility_level: int


PUBLIC_VISIBILITY_LEVEL = 20

type GitLabPullRequestAction = Literal[
    "open", "close", "reopen", "update", "approval", "approved", "unapproval", "unapproved", "merge"
]

PULL_REQUEST_EVENT_ACTION_MAPPING: dict[GitLabPullRequestAction, PullRequestAction] = {
    "open": "opened",
    "close": "closed",
    "reopen": "reopened",
    "update": "edited",
    "merge": "closed",
}


class GitLabPullRequestObjectAttributes(msgspec.Struct, gc=False):
    iid: int
    title: str
    description: str
    state: str
    source_branch: str
    target_branch: str
    action: GitLabPullRequestAction
    draft: bool


class GitLabPullRequestEvent(msgspec.Struct, gc=False):
    object_kind: Literal["merge_request"]
    event_type: Literal["merge_request"]
    project: GitLabPullRequestProject
    object_attributes: GitLabPullRequestObjectAttributes
    user: GitLabPullRequestUser


pull_request_decoder = msgspec.json.Decoder(GitLabPullRequestEvent)


def deserialize_gitlab_event(event: SubscriptionEvent) -> EventType | None:
    assert event["type"] == "gitlab"
    if event["event_type_hint"] == "Merge Request Hook":
        e = pull_request_decoder.decode(event["event"])
        action = PULL_REQUEST_EVENT_ACTION_MAPPING.get(e.object_attributes.action)
        if not action:
            return None

        return PullRequestEvent(
            action=action,
            pull_request={
                "repository_id": str(e.project.id),
                "id": str(e.object_attributes.iid),
                "title": e.object_attributes.title,
                "description": e.object_attributes.description,
                "head": {"ref": e.object_attributes.source_branch, "sha": None},
                "base": {"ref": e.object_attributes.target_branch, "sha": None},
                "is_private_repo": e.project.visibility_level != PUBLIC_VISIBILITY_LEVEL,
                "author": {"id": str(e.user.id), "username": e.user.username},
                "draft": e.object_attributes.draft,
            },
            subscription_event=event,
        )

    else:
        return None
