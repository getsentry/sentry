from sentry.scm.private.webhooks.gitlab import deserialize_gitlab_event
from sentry.scm.types import PullRequestEvent, SubscriptionEvent

MERGE_REQUEST_OPENED_EVENT = """{
    "object_kind": "merge_request",
    "event_type": "merge_request",
    "user": {
        "id": 150871,
        "name": "Vincent Jacques",
        "username": "jacquev6",
        "avatar_url": "https://secure.gravatar.com/avatar/64b276c831d40984ef60c18f9d8d046cffc9b20292e357df709b929a4dc3c188?s=80&d=identicon",
        "email": "[REDACTED]"
    },
    "project": {
        "id": 79787061,
        "name": "test-Sentry-Integration-Dev-jacquev6",
        "description": null,
        "web_url": "https://gitlab.com/jacquev6-sentry/test-sentry-integration-dev-jacquev6",
        "avatar_url": null,
        "git_ssh_url": "git@gitlab.com:jacquev6-sentry/test-sentry-integration-dev-jacquev6.git",
        "git_http_url": "https://gitlab.com/jacquev6-sentry/test-sentry-integration-dev-jacquev6.git",
        "namespace": "jacquev6-sentry",
        "visibility_level": 20,
        "path_with_namespace": "jacquev6-sentry/test-sentry-integration-dev-jacquev6",
        "default_branch": "main",
        "ci_config_path": "",
        "homepage": "https://gitlab.com/jacquev6-sentry/test-sentry-integration-dev-jacquev6",
        "url": "git@gitlab.com:jacquev6-sentry/test-sentry-integration-dev-jacquev6.git",
        "ssh_url": "git@gitlab.com:jacquev6-sentry/test-sentry-integration-dev-jacquev6.git",
        "http_url": "https://gitlab.com/jacquev6-sentry/test-sentry-integration-dev-jacquev6.git"
    },
    "object_attributes": {
        "assignee_id": null,
        "author_id": 150871,
        "created_at": "2026-04-14 05:57:54 UTC",
        "description": "Another PR, to trigger the webhook.",
        "draft": false,
        "head_pipeline_id": null,
        "id": 473622130,
        "iid": 39,
        "last_edited_at": null,
        "last_edited_by_id": null,
        "merge_commit_sha": null,
        "merge_error": null,
        "merge_params": {
            "force_remove_source_branch": true
        },
        "merge_status": "checking",
        "merge_user_id": null,
        "merge_when_pipeline_succeeds": false,
        "milestone_id": null,
        "source_branch": "topics/blih",
        "source_project_id": 79787061,
        "state_id": 1,
        "target_branch": "main",
        "target_project_id": 79787061,
        "time_estimate": 0,
        "title": "PR to trigger webhook 2026-04-14 07:57:54.235823",
        "updated_at": "2026-04-14 05:57:56 UTC",
        "updated_by_id": null,
        "prepared_at": "2026-04-14 05:57:56 UTC",
        "assignee_ids": [],
        "blocking_discussions_resolved": true,
        "detailed_merge_status": "checking",
        "first_contribution": false,
        "human_time_change": null,
        "human_time_estimate": null,
        "human_total_time_spent": null,
        "labels": [],
        "last_commit": {
            "id": "6d8ca33dae268d3c5835e721e5702ef9dcb43c8c",
            "message": "Add blah\\n",
            "title": "Add blah",
            "timestamp": "2026-02-26T09:47:45+01:00",
            "url": "https://gitlab.com/jacquev6-sentry/test-sentry-integration-dev-jacquev6/-/commit/6d8ca33dae268d3c5835e721e5702ef9dcb43c8c",
            "author": {
                "name": "Vincent Jacques",
                "email": "vincent@vincent-jacques.net"
            }
        },
        "reviewer_ids": [],
        "source": {
            "id": 79787061,
            "name": "test-Sentry-Integration-Dev-jacquev6",
            "description": null,
            "web_url": "https://gitlab.com/jacquev6-sentry/test-sentry-integration-dev-jacquev6",
            "avatar_url": null,
            "git_ssh_url": "git@gitlab.com:jacquev6-sentry/test-sentry-integration-dev-jacquev6.git",
            "git_http_url": "https://gitlab.com/jacquev6-sentry/test-sentry-integration-dev-jacquev6.git",
            "namespace": "jacquev6-sentry",
            "visibility_level": 20,
            "path_with_namespace": "jacquev6-sentry/test-sentry-integration-dev-jacquev6",
            "default_branch": "main",
            "ci_config_path": "",
            "homepage": "https://gitlab.com/jacquev6-sentry/test-sentry-integration-dev-jacquev6",
            "url": "git@gitlab.com:jacquev6-sentry/test-sentry-integration-dev-jacquev6.git",
            "ssh_url": "git@gitlab.com:jacquev6-sentry/test-sentry-integration-dev-jacquev6.git",
            "http_url": "https://gitlab.com/jacquev6-sentry/test-sentry-integration-dev-jacquev6.git"
        },
        "state": "opened",
        "system": false,
        "target": {
            "id": 79787061,
            "name": "test-Sentry-Integration-Dev-jacquev6",
            "description": null,
            "web_url": "https://gitlab.com/jacquev6-sentry/test-sentry-integration-dev-jacquev6",
            "avatar_url": null,
            "git_ssh_url": "git@gitlab.com:jacquev6-sentry/test-sentry-integration-dev-jacquev6.git",
            "git_http_url": "https://gitlab.com/jacquev6-sentry/test-sentry-integration-dev-jacquev6.git",
            "namespace": "jacquev6-sentry",
            "visibility_level": 20,
            "path_with_namespace": "jacquev6-sentry/test-sentry-integration-dev-jacquev6",
            "default_branch": "main",
            "ci_config_path": "",
            "homepage": "https://gitlab.com/jacquev6-sentry/test-sentry-integration-dev-jacquev6",
            "url": "git@gitlab.com:jacquev6-sentry/test-sentry-integration-dev-jacquev6.git",
            "ssh_url": "git@gitlab.com:jacquev6-sentry/test-sentry-integration-dev-jacquev6.git",
            "http_url": "https://gitlab.com/jacquev6-sentry/test-sentry-integration-dev-jacquev6.git"
        },
        "time_change": 0,
        "total_time_spent": 0,
        "url": "https://gitlab.com/jacquev6-sentry/test-sentry-integration-dev-jacquev6/-/merge_requests/39",
        "work_in_progress": false,
        "approval_rules": [],
        "action": "open",
        "actioned_at": "2026-04-14 05:57:56 UTC"
    },
    "labels": [],
    "changes": {
        "merge_status": {
            "previous": "preparing",
            "current": "checking"
        },
        "updated_at": {
            "previous": "2026-04-14 05:57:54 UTC",
            "current": "2026-04-14 05:57:56 UTC"
        },
        "prepared_at": {
            "previous": null,
            "current": "2026-04-14 05:57:56 UTC"
        }
    },
    "repository": {
        "name": "test-Sentry-Integration-Dev-jacquev6",
        "url": "git@gitlab.com:jacquev6-sentry/test-sentry-integration-dev-jacquev6.git",
        "description": null,
        "homepage": "https://gitlab.com/jacquev6-sentry/test-sentry-integration-dev-jacquev6"
    }
}"""


def test_deserialize_gitlab_bad_event() -> None:
    subscription_event = SubscriptionEvent(
        {
            "event": "Event",
            "event_type_hint": "Bad Event Type Hint",
            "extra": {},
            "received_at": 0,
            "sentry_meta": [],
            "type": "gitlab",
        }
    )

    assert deserialize_gitlab_event(subscription_event) is None


def test_deserialize_gitlab_merge_request_event() -> None:
    subscription_event = SubscriptionEvent(
        {
            "event": MERGE_REQUEST_OPENED_EVENT,
            "event_type_hint": "Merge Request Hook",
            "extra": {},
            "received_at": 0,
            "sentry_meta": [],
            "type": "gitlab",
        }
    )

    assert deserialize_gitlab_event(subscription_event) == PullRequestEvent(
        action="opened",
        pull_request={
            "repository_id": "79787061",
            "id": "39",
            "title": "PR to trigger webhook 2026-04-14 07:57:54.235823",
            "description": "Another PR, to trigger the webhook.",
            "head": {"ref": "topics/blih", "sha": None},
            "base": {"ref": "main", "sha": None},
            "is_private_repo": False,
            "author": {"id": "150871", "username": "jacquev6"},
            "draft": False,
        },
        subscription_event=subscription_event,
    )
