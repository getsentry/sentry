from __future__ import absolute_import

import pytest
import six

from sentry.testutils import TestCase
from sentry.models import GroupAssignee, Activity


class GroupAssigneeTestCase(TestCase):
    def test_constraints(self):
        # Can't both be assigned
        with pytest.raises(AssertionError):
            GroupAssignee.objects.create(
                group=self.group,
                project=self.group.project,
                user=self.user,
                team=self.team,
            )

        # Can't have nobody assigned
        with pytest.raises(AssertionError):
            GroupAssignee.objects.create(
                group=self.group,
                project=self.group.project,
                user=None,
                team=None,
            )

    def test_assign_user(self):
        GroupAssignee.objects.assign(self.group, self.user)

        assert GroupAssignee.objects.filter(
            project=self.group.project,
            group=self.group,
            user=self.user,
            team__isnull=True,
        ).exists()

        activity = Activity.objects.get(
            project=self.group.project,
            group=self.group,
            type=Activity.ASSIGNED,
        )

        assert activity.data['assignee'] == six.text_type(self.user.id)
        assert activity.data['assigneeEmail'] == self.user.email
        assert activity.data['assigneeType'] == 'user'

    def test_assign_team(self):
        GroupAssignee.objects.assign(self.group, self.team)

        assert GroupAssignee.objects.filter(
            project=self.group.project,
            group=self.group,
            team=self.team,
            user__isnull=True,
        ).exists()

        activity = Activity.objects.get(
            project=self.group.project,
            group=self.group,
            type=Activity.ASSIGNED,
        )

        assert activity.data['assignee'] == six.text_type(self.team.id)
        assert activity.data['assigneeEmail'] is None
        assert activity.data['assigneeType'] == 'team'

    def test_reassign_user_to_team(self):
        GroupAssignee.objects.assign(self.group, self.user)

        assert GroupAssignee.objects.filter(
            project=self.group.project,
            group=self.group,
            user=self.user,
            team__isnull=True,
        ).exists()

        GroupAssignee.objects.assign(self.group, self.team)

        assert GroupAssignee.objects.filter(
            project=self.group.project,
            group=self.group,
            team=self.team,
            user__isnull=True,
        ).exists()

        activity = list(Activity.objects.filter(
            project=self.group.project,
            group=self.group,
            type=Activity.ASSIGNED,
        ).order_by('id'))

        assert activity[0].data['assignee'] == six.text_type(self.user.id)
        assert activity[0].data['assigneeEmail'] == self.user.email
        assert activity[0].data['assigneeType'] == 'user'

        assert activity[1].data['assignee'] == six.text_type(self.team.id)
        assert activity[1].data['assigneeEmail'] is None
        assert activity[1].data['assigneeType'] == 'team'
