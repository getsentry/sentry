from sentry.issues.action_log.types import (
    GroupAction,
    GroupActionType,
    PullRequestClosedAction,
    SeerPRCreatedAction,
    SeerPRReadyForReviewAction,
    SetRegressedAction,
    SetResolvedInReleaseAction,
    SmartAssignmentCompletedAction,
)
from sentry.models.activity import Activity
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.types.activity import ActivityType
from sentry.utils import json
from sentry.utils.action_log.activity_translator import (
    ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE,
    ACTIVITY_TYPES_WITH_NO_ACTION,
    activity_to_action,
)


class ActivityToActionTest(TestCase):
    def test_no_type_overlaps(self) -> None:
        for k in ACTIVITY_TYPES_WITH_NO_ACTION:
            assert k not in ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE.keys()

        for k in ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE.keys():
            assert k not in ACTIVITY_TYPES_WITH_NO_ACTION

    def test_all_types_covered(self) -> None:
        for activity_type in ActivityType:
            assert (
                activity_type.value in ACTIVITY_TYPES_WITH_NO_ACTION
                or activity_type.value in ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE.keys()
            )

    def test_no_return_case(self) -> None:
        first_seen_act = Factories.create_group_activity(
            group=self.group,
            type=ActivityType.FIRST_SEEN.value,
            data={"priority": 1},
        )

        release_act = Activity.objects.create(
            project_id=self.project.id, type=ActivityType.RELEASE.value, data={"version": "abc123"}
        )

        assert activity_to_action(first_seen_act) is None
        assert activity_to_action(release_act) is None

    def test_internal_group_activity(self) -> None:
        act = Factories.create_group_activity(
            group=self.group,
            type=ActivityType.SMART_ASSIGNMENT_COMPLETED.value,
            data={
                "run_id": 123,
                "run_uuid": "00000000-0000-0000-0000-000000000001",
                "predicted_assignee_user_ids": [456, None],
            },
        )

        assert activity_to_action(act) == SmartAssignmentCompletedAction(
            run_id=123,
            run_uuid="00000000-0000-0000-0000-000000000001",
            predicted_assignee_user_ids=[456, None],
        )
        assert (
            GroupActionType.SMART_ASSIGNMENT_COMPLETED not in GroupAction.get_user_visible_types()
        )

    def test_empty_data(self) -> None:
        for activity_type in [
            ActivityType.SET_RESOLVED.value,
            ActivityType.UNASSIGNED.value,
            ActivityType.MARK_REVIEWED.value,
            ActivityType.SET_PUBLIC.value,
            ActivityType.SET_PRIVATE.value,
            ActivityType.DELETED_ATTACHMENT.value,
            ActivityType.SEER_ITERATION_STARTED.value,
            ActivityType.SEER_ITERATION_COMPLETED.value,
        ]:
            act = Factories.create_group_activity(group=self.group, type=activity_type, data={})
            assert activity_to_action(act) is not None

    def test_basic_return(self) -> None:
        act = Factories.create_group_activity(
            group=self.group,
            type=ActivityType.PULL_REQUEST_CLOSED.value,
            data={"pull_request": 123},
        )

        assert activity_to_action(act) == PullRequestClosedAction(pull_request=123)

    def test_extraneous_data(self) -> None:
        act = Factories.create_group_activity(
            group=self.group,
            type=ActivityType.PULL_REQUEST_CLOSED.value,
            data={"pull_request": 123, "extra_data": 456},
        )

        assert activity_to_action(act) == PullRequestClosedAction(pull_request=123)

    def test_optional_field(self) -> None:
        for activity_type, expected_action in (
            (ActivityType.SET_REGRESSION, SetRegressedAction(version="abc")),
            (ActivityType.SET_RESOLVED_IN_RELEASE, SetResolvedInReleaseAction(version="abc")),
        ):
            act = Factories.create_group_activity(
                group=self.group,
                type=activity_type.value,
                data={"version": "abc"},
            )

            assert activity_to_action(act) == expected_action

    def test_seer_pr_actions_allow_null_pr_metadata(self) -> None:
        # Seer can send PR events where the PR metadata is unknown, e.g.
        # provider "unknown" and pr_id/pr_number/pr_url all null.
        pull_requests = [
            {
                "provider": "unknown",
                "repo_name": "example-org/example-repo",
                "pull_request": {"pr_id": None, "pr_number": None, "pr_url": None},
            }
        ]
        for activity_type, action_class in (
            (ActivityType.SEER_PR_CREATED, SeerPRCreatedAction),
            (ActivityType.SEER_PR_READY_FOR_REVIEW, SeerPRReadyForReviewAction),
        ):
            act = Factories.create_group_activity(
                group=self.group,
                type=activity_type.value,
                data={"run_id": 123, "pull_requests": pull_requests},
            )

            assert activity_to_action(act) == action_class(run_id=123, pull_requests=pull_requests)

    def test_strips_null_bytes_from_string_fields(self) -> None:
        # Activity data is stored in a text JSON column that tolerates NUL bytes,
        # but the resulting GroupAction payload is serialized into a Postgres
        # jsonb column, which rejects \u0000 escapes. activity_to_action must
        # scrub null bytes so downstream jsonb writes (outbox payloads,
        # bulk_insert_action_log_entries) don't fail.
        act = Factories.create_group_activity(
            group=self.group,
            type=ActivityType.CREATE_ISSUE.value,
            data={
                "title": "prefix\x00suffix",
                "provider": "ExampleProvider",
                "location": "https://example.invalid/issues/1",
                "label": "example/repo#1",
                "new": True,
            },
        )

        action = activity_to_action(act)

        assert action is not None
        payload = action.dict()
        assert payload["title"] == "prefixsuffix"
        # The serialized payload must not contain a \u0000 escape sequence,
        # which is the shape jsonb rejects.
        assert "\\u0000" not in json.dumps(payload)

    def test_strips_null_bytes_nested(self) -> None:
        # Even fields we don't currently model on GroupAction subclasses can
        # carry null bytes (Pydantic silently drops unknown kwargs). Sanitize
        # the whole data blob defensively so no null byte ever reaches the
        # jsonb payload, regardless of which fields Pydantic keeps.
        act = Factories.create_group_activity(
            group=self.group,
            type=ActivityType.MERGE.value,
            data={
                "issues": [
                    {"id": 1, "label": "clean"},
                    {"id": 2, "label": "with\x00null"},
                ],
            },
        )

        action = activity_to_action(act)

        assert action is not None
        assert "\\u0000" not in json.dumps(action.dict())

    def test_strips_lone_surrogates(self) -> None:
        # Python str tolerates lone UTF-16 surrogates, and Pydantic v1 accepts
        # them, but they can't be encoded as UTF-8 for psycopg2 wire parameters
        # and Postgres jsonb also rejects them. Sanitize like NUL bytes so the
        # payload survives the trip to jsonb.
        act = Factories.create_group_activity(
            group=self.group,
            type=ActivityType.CREATE_ISSUE.value,
            data={
                "title": "before\ud800after",
                "provider": "ExampleProvider",
                "location": "https://example.invalid/issues/2",
                "label": "example/repo#2",
                "new": True,
            },
        )

        action = activity_to_action(act)

        assert action is not None
        # The sanitized payload must be encodable as UTF-8; lone surrogates raise
        # UnicodeEncodeError, which is what breaks psycopg2 param encoding.
        action.dict()["title"].encode("utf-8")
        assert "\ud800" not in action.dict()["title"]

    def test_strips_bad_chars_in_dict_keys(self) -> None:
        # Dict keys go into jsonb too. Activity keys are normally set by
        # internal Sentry code, but the sanitizer should still handle a bad key
        # so the pre-flight scan and the rewrite agree.
        act = Factories.create_group_activity(
            group=self.group,
            type=ActivityType.MERGE.value,
            data={
                # An unmodeled sibling key with a NUL byte — MERGE only reads
                # "issues", so Pydantic will drop this, but the pre-flight scan
                # must still see it and the sanitized data must not carry it
                # forward if we ever surface unknown keys.
                "extra\x00key": "value",
                "issues": [{"id": 1}],
            },
        )

        action = activity_to_action(act)

        assert action is not None
        assert "\\u0000" not in json.dumps(action.dict())
