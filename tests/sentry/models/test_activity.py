from typing import Sequence

from sentry.models import Activity
from sentry.testutils import TestCase
from sentry.types.activity import ActivityType


class ActivityTest(TestCase):
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

        act_for_group: Sequence[Activity] = Activity.objects.get_activities_for_group(
            group=group, num=100
        )
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

        act_for_group: Sequence[Activity] = Activity.objects.get_activities_for_group(
            group=group, num=100
        )
        assert len(act_for_group) == 7
        assert act_for_group[0] == activities[-1]
        assert act_for_group[1] == activities[-2]
        assert act_for_group[2] == activities[-3]
        assert act_for_group[3] == activities[-4]
        assert act_for_group[4] == activities[1]
        assert act_for_group[5] == activities[0]
        assert act_for_group[-1].type == ActivityType.FIRST_SEEN.value
