from __future__ import absolute_import

from sentry.models import UserOption, UserOptionValue
from sentry.testutils import TestCase


class UserOptionManagerTest(TestCase):
    def test_simple(self):
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(owner=None)
        self.team = self.create_team(organization=self.org)
        self.create_member(user=self.user, organization=self.org, teams=[self.team])

        UserOption.objects.set_value(
            user=self.user,
            organization=self.org,
            key='deploy-emails',
            value=UserOptionValue.all_deploys,
        )

        UserOption.objects.unset_value(
            user=self.user,
            organization=self.org,
            key='deploy-emails',
        )

        assert UserOption.objects.get_value(
            user=self.user,
            key='deploy-emails',
            organization=self.org,
            default=UserOptionValue.committed_deploys_only,
        ) == UserOptionValue.committed_deploys_only

        assert UserOption.objects.filter(
            user=self.user,
            key='deploy-emails',
            organization=self.org,
        ).first() is None
