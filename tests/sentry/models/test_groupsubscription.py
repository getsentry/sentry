from __future__ import absolute_import

from sentry.models import GroupSubscription
from sentry.testutils import TestCase


class SubscribeTest(TestCase):
    def test_simple(self):
        group = self.create_group()
        user = self.create_user()

        GroupSubscription.objects.subscribe(group=group, user=user)

        assert GroupSubscription.objects.filter(
            group=group,
            user=user,
        ).exists()

        # should not error
        GroupSubscription.objects.subscribe(group=group, user=user)
