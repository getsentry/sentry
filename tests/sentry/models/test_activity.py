import logging
from unittest.mock import MagicMock, patch

from sentry.event_manager import EventManager
from sentry.issues.grouptype import MetricIssuePOC
from sentry.models.activity import Activity
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType
from sentry.types.group import PriorityLevel
from sentry.utils.iterators import chunked
from tests.sentry.event_manager.test_event_manager import make_event


class ActivityTest(TestCase):
    def test_get_activities_for_group_none(self):
        project = self.create_project(name="test_activities_group")
        group = self.create_group(project)

        act_for_group = Activity.objects.get_activities_for_group(group=group, num=100)
        assert len(act_for_group) == 1
        assert act_for_group[0].type == ActivityType.FIRST_SEEN.value

    def test_get_activities_for_group_priority(self):
        manager = EventManager(make_event(level=logging.FATAL))
        project = self.create_project(name="test_activities_group")
        event = manager.save(project.id)
        user1 = self.create_user()
        group = event.group
        assert group is not None
        group.refresh_from_db()

        activities = [
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_UNRESOLVED,
                user=user1,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_PRIORITY,
                user=user1,
                data={"priority": PriorityLevel.LOW.to_str()},
                send_notification=False,
            ),
        ]

        act_for_group = Activity.objects.get_activities_for_group(group=group, num=100)
        assert len(act_for_group) == 3
        assert act_for_group[0] == activities[-1]
        assert act_for_group[1] == activities[-2]
        assert act_for_group[-1].type == ActivityType.FIRST_SEEN.value
        assert act_for_group[-1].data["priority"] == PriorityLevel.HIGH.to_str()

    def test_get_activities_for_group_simple_priority_ff_on_dups(self):
        manager = EventManager(make_event(level=logging.FATAL))
        project = self.create_project(name="test_activities_group")
        event = manager.save(project.id)
        user1 = self.create_user()
        group = event.group
        assert group is not None
        group.refresh_from_db()

        activities = [
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_PRIORITY,
                user=user1,
                data={"priority": PriorityLevel.LOW.to_str()},
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_PRIORITY,
                user=user1,
                data={"priority": PriorityLevel.LOW.to_str()},
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_PRIORITY,
                user=user1,
                data={"priority": PriorityLevel.MEDIUM.to_str()},
                send_notification=False,
            ),
        ]

        act_for_group = Activity.objects.get_activities_for_group(group=group, num=100)

        assert len(act_for_group) == 3
        assert act_for_group[0] == activities[-1]
        assert act_for_group[1] == activities[-2]
        assert act_for_group[-1].type == ActivityType.FIRST_SEEN.value
        assert act_for_group[-1].data["priority"] == PriorityLevel.HIGH.to_str()

    def test_get_activities_for_group_simple(self):
        project = self.create_project(name="test_activities_group")
        group = self.create_group(project)
        user1 = self.create_user()

        activities = [
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_UNRESOLVED,
                user=user1,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_IGNORED,
                user=user1,
                data=None,
                send_notification=False,
            ),
        ]

        act_for_group = Activity.objects.get_activities_for_group(group=group, num=100)
        assert len(act_for_group) == 3
        assert act_for_group[0] == activities[-1]
        assert act_for_group[1] == activities[-2]
        assert act_for_group[-1].type == ActivityType.FIRST_SEEN.value

    def test_get_activities_for_group_collapse_same(self):
        project = self.create_project(name="test_activities_group")
        group = self.create_group(project)
        user1 = self.create_user()
        user2 = self.create_user()
        user3 = self.create_user()

        activities = [
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_UNRESOLVED,
                user=user1,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_IGNORED,
                user=user1,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_UNRESOLVED,
                user=user1,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_UNRESOLVED,
                user=user1,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_UNRESOLVED,
                user=user1,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_UNRESOLVED,
                user=user1,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_UNRESOLVED,
                user=user1,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_UNRESOLVED,
                user=user1,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.NOTE,
                user=user1,
                data={"text": "text", "mentions": []},
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.NOTE,
                user=user2,
                data={"text": "text", "mentions": []},
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.NOTE,
                user=user3,
                data={"text": "text", "mentions": []},
                send_notification=False,
            ),
        ]

        act_for_group = Activity.objects.get_activities_for_group(group=group, num=100)
        assert len(act_for_group) == 7
        assert act_for_group[0] == activities[-1]
        assert act_for_group[1] == activities[-2]
        assert act_for_group[2] == activities[-3]
        assert act_for_group[3] == activities[-4]
        assert act_for_group[4] == activities[1]
        assert act_for_group[5] == activities[0]
        assert act_for_group[-1].type == ActivityType.FIRST_SEEN.value

    def test_get_activities_for_group_flip_flop(self):
        project = self.create_project(name="test_activities_group")
        group = self.create_group(project)
        user1 = self.create_user()
        user2 = self.create_user()
        user3 = self.create_user()

        activities = [
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_UNRESOLVED,
                user=user1,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_IGNORED,
                user=user1,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_UNRESOLVED,
                user=user2,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_IGNORED,
                user=user2,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_UNRESOLVED,
                user=user3,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_IGNORED,
                user=user3,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_UNRESOLVED,
                user=user1,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_IGNORED,
                user=user1,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_UNRESOLVED,
                user=user1,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_IGNORED,
                user=user1,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_UNRESOLVED,
                user=user1,
                data=None,
                send_notification=False,
            ),
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.SET_IGNORED,
                user=user1,
                data=None,
                send_notification=False,
            ),
        ]

        act_for_group = Activity.objects.get_activities_for_group(group=group, num=100)

        assert len(act_for_group) == len(activities) + 1
        assert act_for_group[-1].type == ActivityType.FIRST_SEEN.value

        for pair in chunked(act_for_group[:-1], 2):
            assert pair[0].type == ActivityType.SET_IGNORED.value
            assert pair[1].type == ActivityType.SET_UNRESOLVED.value

    @patch("sentry.tasks.activity.send_activity_notifications.delay")
    def test_skips_status_change_notifications_if_disabled(
        self, mock_send_activity_notifications: MagicMock
    ):
        project = self.create_project(name="test_activities_group")
        group = self.create_group(project)

        # Create an activity that would normally trigger a notification
        activity = Activity.objects.create_group_activity(
            group=group, type=ActivityType.SET_UNRESOLVED, data=None, send_notification=True
        )

        mock_send_activity_notifications.assert_called_once_with(activity.id)
        mock_send_activity_notifications.reset_mock()

        group.type = MetricIssuePOC.type_id
        group.save()
        _ = Activity.objects.create_group_activity(
            group=group, type=ActivityType.SET_RESOLVED, data=None, send_notification=True
        )

        mock_send_activity_notifications.assert_not_called()
