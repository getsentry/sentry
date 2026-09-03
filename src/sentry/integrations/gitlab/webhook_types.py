from __future__ import annotations

from collections.abc import Mapping

GITLAB_WEBHOOK_TYPE_HEADER = "HTTP_X_GITLAB_EVENT"

# The events GitlabWebhookEndpoint handles, keyed by the `X-Gitlab-Event` header it
# dispatches on. Mailboxes use `object_kind` because header values contain spaces.
GITLAB_EVENT_KINDS: Mapping[str, str] = {
    "Push Hook": "push",
    "Merge Request Hook": "merge_request",
    "Note Hook": "note",
    "Issue Hook": "issue",
}

CELL_PROCESSED_GITLAB_EVENTS = frozenset(GITLAB_EVENT_KINDS.values())
