from typing import Any

from openapi_schema_validator import OAS30Validator

from sentry.api.serializers import serialize
from sentry.api.serializers.models.activity_response_schemas import (
    activity_type_names,
    group_activity_schema,
)
from sentry.api.serializers.models.groupactionlogentry import serialize_first_seen_entry
from sentry.apidocs.hooks import _fix_nullable_enums
from sentry.issues.action_log.types import FirstSeenAction, GroupAction, GroupActionType
from sentry.models.activity import Activity
from sentry.models.commit import Commit
from sentry.models.pullrequest import PullRequest
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType
from sentry.utils import json
from sentry.utils.action_log.activity_translator import activity_to_action

EVENT_ID = "a" * 32
SEER_PULL_REQUESTS = [
    {
        "provider": "github",
        "repo_name": "owner/repo",
        "pull_request": {"pr_number": 42, "pr_url": "https://github.com/owner/repo/pull/42"},
    }
]
INTEGRATION = {"provider": "Jira", "provider_key": "jira", "integration_id": 1}


class GroupActivitySchemaTest(TestCase):
    """
    Serializes every activity type through both feed serializers and checks the result
    against the API schema, so the schema can't fall behind either serializer.
    """

    def setUp(self) -> None:
        super().setUp()
        schema = group_activity_schema()
        _fix_nullable_enums(schema)
        branches = {branch["properties"]["type"]["enum"][0]: branch for branch in schema["anyOf"]}
        self.validators = {name: OAS30Validator(branch) for name, branch in branches.items()}
        self.data_keys = {
            name: {
                key
                for shape in branch["properties"]["data"].get(
                    "anyOf", [branch["properties"]["data"]]
                )
                for key in shape.get("properties", {})
            }
            for name, branch in branches.items()
        }
        repo = self.create_repo(self.project, name="owner/repo")
        commit = Commit.objects.create(
            organization_id=self.organization.id, repository_id=repo.id, key="abc123"
        )
        pull_request = PullRequest.objects.create(
            organization_id=self.organization.id, repository_id=repo.id, key="5", title="Fix"
        )
        other = self.create_group()
        self.activity_data: dict[ActivityType, list[dict[str, Any] | None]] = {
            ActivityType.SET_RESOLVED: [None, INTEGRATION],
            ActivityType.SET_UNRESOLVED: [{"event_id": EVENT_ID}, {"forecast": 10}, INTEGRATION],
            ActivityType.SET_IGNORED: [
                {
                    "ignoreCount": 10,
                    "ignoreDuration": None,
                    "ignoreUntil": None,
                    "ignoreUserCount": None,
                    "ignoreUserWindow": None,
                    "ignoreWindow": 60,
                    "ignoreUntilEscalating": False,
                }
            ],
            ActivityType.SET_PUBLIC: [None],
            ActivityType.SET_PRIVATE: [None],
            ActivityType.SET_REGRESSION: [
                {
                    "event_id": EVENT_ID,
                    "version": "1.1",
                    "event_type": "error",
                    "follows_semver": True,
                    "resolved_in_version": "1.0",
                }
            ],
            ActivityType.CREATE_ISSUE: [
                {
                    "title": "Fix it",
                    "provider": "Jira",
                    "location": "https://example.atlassian.net/browse/PROJ-1",
                    "label": "PROJ-1",
                    "new": True,
                }
            ],
            ActivityType.NOTE: [{"text": "Looking into it"}],
            ActivityType.ASSIGNED: [
                {
                    "assignee": str(self.user.id),
                    "assigneeEmail": self.user.email,
                    "assigneeName": self.user.name,
                    "assigneeType": "user",
                    "integration": "codeowners",
                    "rule": "path:src/* user@example.com",
                }
            ],
            ActivityType.UNASSIGNED: [None],
            ActivityType.SET_RESOLVED_IN_RELEASE: [
                {"version": ""},
                {"version": "1.0", "current_release_version": "0.9", "inNextRelease": True},
                {"version": "1.0", **INTEGRATION},
            ],
            ActivityType.MERGE: [{"issues": [{"id": other.id}]}],
            ActivityType.SET_RESOLVED_BY_AGE: [{"age": 24}],
            ActivityType.SET_RESOLVED_IN_COMMIT: [{"commit": commit.id}],
            ActivityType.UNMERGE_SOURCE: [{"destination_id": other.id, "fingerprints": ["a"]}],
            ActivityType.UNMERGE_DESTINATION: [{"source_id": other.id, "fingerprints": ["a"]}],
            ActivityType.SET_RESOLVED_IN_PULL_REQUEST: [{"pull_request": pull_request.id}],
            ActivityType.REPROCESS: [{"eventCount": 1, "oldGroupId": other.id, "newGroupId": 2}],
            ActivityType.MARK_REVIEWED: [None],
            ActivityType.AUTO_SET_ONGOING: [{"after_days": 7}, {"manually": True}],
            ActivityType.SET_ESCALATING: [
                {
                    "event_id": EVENT_ID,
                    "forecast": 10,
                    "expired_snooze": {
                        "count": 10,
                        "until": None,
                        "user_count": None,
                        "user_window": None,
                        "window": 60,
                    },
                }
            ],
            ActivityType.SET_PRIORITY: [{"priority": "high", "reason": "escalating"}],
            ActivityType.DELETED_ATTACHMENT: [{}],
            ActivityType.REFERENCED_IN_COMMIT: [{"commit": commit.id}],
            ActivityType.SEER_RCA_STARTED: [{"run_id": 1}],
            ActivityType.SEER_RCA_COMPLETED: [{"run_id": 1, "summary": "Null user"}],
            ActivityType.SEER_SOLUTION_STARTED: [{"run_id": 1}],
            ActivityType.SEER_SOLUTION_COMPLETED: [{"run_id": 1, "summary": "Check for null"}],
            ActivityType.SEER_CODING_STARTED: [{"run_id": 1}],
            ActivityType.SEER_CODING_COMPLETED: [{"run_id": 1}],
            ActivityType.SEER_PR_CREATED: [{"run_id": 1, "pull_requests": SEER_PULL_REQUESTS}],
            ActivityType.SEER_PR_READY_FOR_REVIEW: [
                {"run_id": 1, "pull_requests": SEER_PULL_REQUESTS}
            ],
            ActivityType.SEER_ITERATION_STARTED: [{"run_id": 1, "referrer": "slack"}],
            ActivityType.SEER_ITERATION_COMPLETED: [
                {"run_id": 1, "iteration_index": 2, "pull_requests": SEER_PULL_REQUESTS}
            ],
            ActivityType.PULL_REQUEST_CLOSED: [
                {"pull_request": pull_request.id, "has_other_open_prs": False}
            ],
            ActivityType.PULL_REQUEST_REOPENED: [{"pull_request": pull_request.id}],
            ActivityType.PULL_REQUEST_MERGED: [
                {"pull_request": pull_request.id, "has_other_open_prs": True}
            ],
            ActivityType.PULL_REQUEST_UNLINKED: [
                {"pull_request": pull_request.id, "has_other_open_prs": False}
            ],
            ActivityType.TRIGGER_AUTOFIX: [{"referrer": "slack"}],
        }
        self.action_log_data: dict[GroupActionType, dict[str, Any]] = {
            GroupActionType.UNLINK_EXTERNAL_ISSUE: {
                "provider": "jira",
                "external_issue_key": "PROJ-1",
            },
            GroupActionType.UNLINK_PLATFORM_EXTERNAL_ISSUE: {
                "service_type": "my-app",
                "display_name": "Ticket #1",
                "web_url": "https://example.com/tickets/1",
            },
            GroupActionType.IMPACT_ASSESSMENT: {
                "score": 73.5,
                "description": "Users cannot submit an order.",
                "citations": [
                    {"reference": "event", "claim": "The request failed.", "source": "event"}
                ],
                "source_event_id": EVENT_ID,
            },
        }

    def assert_valid(self, item: Any) -> None:
        item = json.loads(json.dumps(item))
        errors = [
            f"{list(error.absolute_path)}: {error.message}"
            for error in self.validators[item["type"]].iter_errors(item)
        ]
        assert not errors, (item["type"], item["data"], errors)
        # Objects allow unknown keys, so check that the schema names every key returned.
        assert set(item["data"]) <= self.data_keys[item["type"]], (item["type"], item["data"])

    def test_every_type_has_a_sample(self) -> None:
        sampled = {t.name.lower() for t in self.activity_data} | {
            t.name.lower() for t in self.action_log_data
        }
        # Both paths build the first-seen item themselves; see test_first_seen_matches_schema.
        sampled.add("first_seen")
        assert sampled == set(activity_type_names())

    def test_activities_match_schema(self) -> None:
        for activity_type, samples in self.activity_data.items():
            for data in samples:
                activity = Activity.objects.create(
                    project=self.project,
                    group=self.group,
                    type=activity_type.value,
                    user_id=self.user.id,
                    data=data,
                )
                self.assert_valid(serialize(activity, self.user))

    def test_first_seen_matches_schema(self) -> None:
        for activity in Activity.objects.get_activities_for_group(self.group, 10):
            self.assert_valid(serialize(activity, self.user))
        entry = self.create_group_action_log_entry(
            type=GroupActionType.FIRST_SEEN,
            data=FirstSeenAction(first_seen=self.group.first_seen).json_dict(),
        )
        self.assert_valid(serialize_first_seen_entry(self.group))
        self.assert_valid(serialize_first_seen_entry(self.group, entry))

    def test_action_log_entries_match_schema(self) -> None:
        for activity_type, samples in self.activity_data.items():
            if activity_type == ActivityType.NOTE:
                # Notes come from GroupNote, not from comment entries.
                continue
            for data in samples:
                activity = Activity(
                    project=self.project, group=self.group, type=activity_type.value, data=data
                )
                action = activity_to_action(activity)
                assert action is not None
                entry = self.create_group_action_log_entry(
                    type=action.get_type(), data=action.json_dict()
                )
                self.assert_valid(serialize(entry, self.user))

        for action_type, data in self.action_log_data.items():
            action_cls = GroupAction.by_type(action_type)
            assert action_cls is not None
            entry = self.create_group_action_log_entry(
                type=action_type, data=action_cls(**data).json_dict()
            )
            self.assert_valid(serialize(entry, self.user))
