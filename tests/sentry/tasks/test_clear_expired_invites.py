from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from sentry.models import OrganizationMember
from sentry.tasks.clear_expired_invites import clear_expired_invites
from sentry.testutils import TestCase


class ClearExpiredInvites(TestCase):
    def test_clear_expired_invite(self):
        organization = self.create_organization()
        ninety_one_days = timezone.now() - timedelta(days=91)
        member = OrganizationMember.objects.create(
            organization=organization,
            role='member',
            email='test@example.com',
            token='abc-def',
            token_expires_at=ninety_one_days
        )
        clear_expired_invites()
        assert OrganizationMember.objects.filter(id=member.id).first() is None

    def test_leave_recently_expired(self):
        organization = self.create_organization()
        eighty_nine_days = timezone.now() - timedelta(days=89)
        member = OrganizationMember.objects.create(
            organization=organization,
            role='member',
            email='test@example.com',
            token='abc-def',
            token_expires_at=eighty_nine_days
        )
        clear_expired_invites()
        assert OrganizationMember.objects.get(id=member.id)

    def test_leave_claimed_invite(self):
        user = self.create_user()
        organization = self.create_organization()
        member = OrganizationMember.objects.create(
            organization=organization,
            role='member',
            user=user,
            email='test@example.com',
            token='abc-def',
            token_expires_at='2018-01-01 10:00:00'
        )
        clear_expired_invites()
        assert OrganizationMember.objects.get(id=member.id)

    def test_leave_new_invite(self):
        user = self.create_user()
        organization = self.create_organization()

        ten_days = timezone.now() + timedelta(days=10)
        member = OrganizationMember.objects.create(
            organization=organization,
            role='member',
            user=user,
            email='test@example.com',
            token='abc-def',
            token_expires_at=ten_days
        )
        clear_expired_invites()
        assert OrganizationMember.objects.get(id=member.id)
