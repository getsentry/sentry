from sentry.issues.action_log.types import PullRequestClosedAction, SetRegressedAction
from sentry.models.activity import Activity
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.types.activity import ActivityType
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
        act = Factories.create_group_activity(
            group=self.group,
            type=ActivityType.SET_REGRESSION.value,
            data={"version": "abc"},
        )

        assert activity_to_action(act) == SetRegressedAction(version="abc")
