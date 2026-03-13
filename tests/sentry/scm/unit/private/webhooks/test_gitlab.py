import orjson

from sentry.scm.private.webhooks.gitlab import (
    deserialize_gitlab_event,
    deserialize_gitlab_event_type_hint,
    deserialize_gitlab_merge_request_event,
)
from sentry.scm.types import SubscriptionEvent


def _make_subscription_event(
    gitlab_event: dict,
    event_type_hint: str = "Merge Request Hook",
) -> SubscriptionEvent:
    return {
        "event_type_hint": event_type_hint,
        "event": orjson.dumps(gitlab_event).decode("utf-8"),
        "extra": {},
        "received_at": 1700000000,
        "sentry_meta": [
            {"id": None, "integration_id": 1, "organization_id": 1},
        ],
        "type": "gitlab",
    }


def _make_gitlab_mr_event(
    action: str | None = "open",
    iid: int = 42,
    title: str = "Fix bug",
    source_branch: str = "feature",
    target_branch: str = "main",
    head_sha: str = "abc123",
    visibility: str = "private",
    description: str | None = "A merge request",
    changes: dict | None = None,
) -> dict:
    event: dict = {
        "object_kind": "merge_request",
        "user": {"id": 100, "username": "testuser"},
        "object_attributes": {
            "iid": iid,
            "title": title,
            "action": action,
            "source_branch": source_branch,
            "target_branch": target_branch,
            "description": description,
            "last_commit": {"id": head_sha},
        },
        "project": {
            "id": 10,
            "path_with_namespace": "group/project",
            "web_url": "https://gitlab.com/group/project",
            "visibility": visibility,
        },
    }
    if changes is not None:
        event["changes"] = changes
    return event


class TestGitLabEventTypeHint:
    def test_merge_request_hook(self):
        event = _make_subscription_event(_make_gitlab_mr_event())
        assert deserialize_gitlab_event_type_hint(event) == "pull_request"

    def test_push_hook_returns_none(self):
        event = _make_subscription_event(_make_gitlab_mr_event(), event_type_hint="Push Hook")
        assert deserialize_gitlab_event_type_hint(event) is None

    def test_unknown_hook_returns_none(self):
        event = _make_subscription_event(_make_gitlab_mr_event(), event_type_hint="Note Hook")
        assert deserialize_gitlab_event_type_hint(event) is None


class TestGitLabActionMapping:
    def test_open_maps_to_opened(self):
        event = _make_subscription_event(_make_gitlab_mr_event(action="open"))
        result = deserialize_gitlab_merge_request_event(event)
        assert result is not None
        assert result.action == "opened"

    def test_close_maps_to_closed(self):
        event = _make_subscription_event(_make_gitlab_mr_event(action="close"))
        result = deserialize_gitlab_merge_request_event(event)
        assert result is not None
        assert result.action == "closed"

    def test_merge_maps_to_closed(self):
        event = _make_subscription_event(_make_gitlab_mr_event(action="merge"))
        result = deserialize_gitlab_merge_request_event(event)
        assert result is not None
        assert result.action == "closed"

    def test_reopen_maps_to_reopened(self):
        event = _make_subscription_event(_make_gitlab_mr_event(action="reopen"))
        result = deserialize_gitlab_merge_request_event(event)
        assert result is not None
        assert result.action == "reopened"

    def test_update_with_oldrev_maps_to_synchronize(self):
        event = _make_subscription_event(
            _make_gitlab_mr_event(action="update", changes={"oldrev": "def456"})
        )
        result = deserialize_gitlab_merge_request_event(event)
        assert result is not None
        assert result.action == "synchronize"

    def test_update_without_oldrev_returns_none(self):
        event = _make_subscription_event(_make_gitlab_mr_event(action="update", changes={}))
        result = deserialize_gitlab_merge_request_event(event)
        assert result is None

    def test_update_without_changes_returns_none(self):
        event = _make_subscription_event(_make_gitlab_mr_event(action="update"))
        result = deserialize_gitlab_merge_request_event(event)
        assert result is None

    def test_unsupported_action_returns_none(self):
        event = _make_subscription_event(_make_gitlab_mr_event(action="approved"))
        result = deserialize_gitlab_merge_request_event(event)
        assert result is None

    def test_none_action_returns_none(self):
        event = _make_subscription_event(_make_gitlab_mr_event(action=None))
        result = deserialize_gitlab_merge_request_event(event)
        assert result is None


class TestGitLabPullRequestEventData:
    def test_fields_from_open_event(self):
        event = _make_subscription_event(
            _make_gitlab_mr_event(
                action="open",
                iid=99,
                title="Add feature",
                source_branch="feat/new",
                target_branch="develop",
                head_sha="sha123",
                visibility="private",
                description="My MR desc",
            )
        )
        result = deserialize_gitlab_merge_request_event(event)
        assert result is not None
        assert result.pull_request["id"] == "99"
        assert result.pull_request["title"] == "Add feature"
        assert result.pull_request["description"] == "My MR desc"
        assert result.pull_request["head"] == {"ref": "feat/new", "sha": "sha123"}
        assert result.pull_request["base"] == {"ref": "develop", "sha": ""}
        assert result.pull_request["is_private_repo"] is True
        assert result.pull_request["author"] == {"id": "100", "username": "testuser"}

    def test_public_repo(self):
        event = _make_subscription_event(_make_gitlab_mr_event(visibility="public"))
        result = deserialize_gitlab_merge_request_event(event)
        assert result is not None
        assert result.pull_request["is_private_repo"] is False

    def test_internal_repo_not_private(self):
        event = _make_subscription_event(_make_gitlab_mr_event(visibility="internal"))
        result = deserialize_gitlab_merge_request_event(event)
        assert result is not None
        assert result.pull_request["is_private_repo"] is False

    def test_no_visibility_defaults_to_private(self):
        event = _make_subscription_event(
            _make_gitlab_mr_event(visibility=None)  # type: ignore[arg-type]
        )
        # Need to manually construct since our helper sets visibility
        gitlab_event = _make_gitlab_mr_event()
        gitlab_event["project"]["visibility"] = None
        event = _make_subscription_event(gitlab_event)
        result = deserialize_gitlab_merge_request_event(event)
        assert result is not None
        assert result.pull_request["is_private_repo"] is True

    def test_subscription_event_preserved(self):
        sub_event = _make_subscription_event(_make_gitlab_mr_event())
        result = deserialize_gitlab_merge_request_event(sub_event)
        assert result is not None
        assert result.subscription_event is sub_event


class TestDeserializeGitLabEvent:
    def test_merge_request_hook(self):
        event = _make_subscription_event(_make_gitlab_mr_event(action="open"))
        result = deserialize_gitlab_event(event)
        assert result is not None
        assert result.action == "opened"

    def test_non_merge_request_hook_returns_none(self):
        event = _make_subscription_event(_make_gitlab_mr_event(), event_type_hint="Push Hook")
        result = deserialize_gitlab_event(event)
        assert result is None

    def test_unsupported_action_returns_none(self):
        event = _make_subscription_event(_make_gitlab_mr_event(action="approved"))
        result = deserialize_gitlab_event(event)
        assert result is None
