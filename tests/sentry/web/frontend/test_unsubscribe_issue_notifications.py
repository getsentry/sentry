from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.models import GroupSubscription
from sentry.utils.linksign import generate_signed_link


class UnsubscribeIssueNotificationsTest(TestCase):
    def test_renders(self):
        group = self.create_group()

        path = generate_signed_link(
            user=self.user,
            viewname='sentry-account-email-unsubscribe-issue',
            args=[group.id],
        )

        resp = self.client.get(path)

        assert resp.status_code == 200

    def test_process(self):
        group = self.create_group()

        path = generate_signed_link(
            user=self.user,
            viewname='sentry-account-email-unsubscribe-issue',
            args=[group.id],
        )

        resp = self.client.post(path, data={'op': 'unsubscribe'})

        assert resp.status_code == 302
        assert GroupSubscription.objects.filter(
            user=self.user,
            group=group,
            is_active=False,
        ).exists()

    def test_no_access(self):
        user = self.create_user('foo@example.com')
        group = self.create_group()

        path = generate_signed_link(
            user=user,
            viewname='sentry-account-email-unsubscribe-issue',
            args=[group.id],
        )

        resp = self.client.get(path)

        assert resp.status_code == 404

    def test_invalid_issue(self):

        path = generate_signed_link(
            user=self.user,
            viewname='sentry-account-email-unsubscribe-issue',
            args=[13413434],
        )

        resp = self.client.get(path)

        assert resp.status_code == 404
