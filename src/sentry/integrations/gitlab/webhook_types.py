from __future__ import annotations

from collections.abc import Mapping

GITLAB_WEBHOOK_TYPE_HEADER = "HTTP_X_GITLAB_EVENT"

# The events GitlabWebhookEndpoint processes: the `X-Gitlab-Event` header it
# dispatches on, mapped to the `object_kind` the body carries. Mailbox names use
# `object_kind` because the header's values contain spaces.
GITLAB_EVENT_KINDS: Mapping[str, str] = {
    "Push Hook": "push",
    "Merge Request Hook": "merge_request",
    "Note Hook": "note",
    "Issue Hook": "issue",
}

CELL_PROCESSED_GITLAB_EVENTS = frozenset(GITLAB_EVENT_KINDS.values())
