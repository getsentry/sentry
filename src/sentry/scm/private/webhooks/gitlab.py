import msgspec

from sentry.scm.types import (
    EventType,
    EventTypeHint,
    PullRequestAction,
    PullRequestEvent,
    SubscriptionEvent,
)


class GitLabUser(msgspec.Struct, gc=False):
    id: int
    username: str


class GitLabMergeRequestLastCommit(msgspec.Struct, gc=False):
    id: str  # SHA


class GitLabMergeRequestChanges(msgspec.Struct, gc=False):
    oldrev: str | None = None


class GitLabMergeRequestObjectAttributes(msgspec.Struct, gc=False):
    iid: int
    title: str
    action: str | None = None
    source_branch: str = ""
    target_branch: str = ""
    description: str | None = None
    last_commit: GitLabMergeRequestLastCommit | None = None


class GitLabProject(msgspec.Struct, gc=False):
    id: int
    path_with_namespace: str
    web_url: str
    visibility: str | None = None


class GitLabMergeRequestEvent(msgspec.Struct, gc=False):
    object_kind: str
    user: GitLabUser
    object_attributes: GitLabMergeRequestObjectAttributes
    project: GitLabProject
    changes: GitLabMergeRequestChanges | None = None


merge_request_decoder = msgspec.json.Decoder(GitLabMergeRequestEvent)

# GitLab action → normalized PullRequestAction
GITLAB_ACTION_MAP: dict[str, PullRequestAction] = {
    "open": "opened",
    "close": "closed",
    "merge": "closed",
    "reopen": "reopened",
}


def _map_gitlab_action(
    action: str | None, changes: GitLabMergeRequestChanges | None
) -> PullRequestAction | None:
    if action is None:
        return None

    # "update" with oldrev present means new commits were pushed
    if action == "update" and changes is not None and changes.oldrev is not None:
        return "synchronize"

    return GITLAB_ACTION_MAP.get(action)


def deserialize_gitlab_merge_request_event(
    event: SubscriptionEvent,
) -> PullRequestEvent | None:
    e = merge_request_decoder.decode(event["event"])

    mapped_action = _map_gitlab_action(e.object_attributes.action, e.changes)
    if mapped_action is None:
        return None

    head_sha = e.object_attributes.last_commit.id if e.object_attributes.last_commit else ""
    is_private = e.project.visibility == "private" if e.project.visibility is not None else True

    return PullRequestEvent(
        action=mapped_action,
        pull_request={
            "id": str(e.object_attributes.iid),
            "title": e.object_attributes.title,
            "description": e.object_attributes.description,
            "head": {"ref": e.object_attributes.source_branch, "sha": head_sha},
            "base": {"ref": e.object_attributes.target_branch, "sha": ""},
            "is_private_repo": is_private,
            "author": {"id": str(e.user.id), "username": e.user.username},
        },
        subscription_event=event,
    )


def deserialize_gitlab_event_type_hint(event: SubscriptionEvent) -> EventTypeHint | None:
    if event["event_type_hint"] == "Merge Request Hook":
        return "pull_request"
    return None


def deserialize_gitlab_event(event: SubscriptionEvent) -> EventType | None:
    event_type_hint = deserialize_gitlab_event_type_hint(event)
    if event_type_hint is None:
        return None

    if event_type_hint == "pull_request":
        return deserialize_gitlab_merge_request_event(event)

    return None
