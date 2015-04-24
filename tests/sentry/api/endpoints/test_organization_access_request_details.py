from __future__ import absolute_import

from django.core import mail
from django.core.urlresolvers import reverse

from sentry.models import (
    OrganizationAccessRequest, OrganizationMemberTeam, OrganizationMemberType
)
from sentry.testutils import APITestCase


class UpdateOrganizationAccessRequestTest(APITestCase):
    def test_approve_request(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        user = self.create_user('bar@example.com')
        member = self.create_member(
            organization=organization,
            user=user,
            type=OrganizationMemberType.MEMBER,
            has_global_access=False,
        )
        team = self.create_team(name='foo', organization=organization)

        access_request = OrganizationAccessRequest.objects.create(
            member=member,
            team=team,
        )

        path = reverse('sentry-api-0-organization-access-request-details', args=[organization.slug, access_request.id])

        self.login_as(self.user)

        resp = self.client.put(path, data={'isApproved': 1})

        assert resp.status_code == 204

        assert OrganizationMemberTeam.objects.filter(
            organizationmember=member,
            team=team,
            is_active=True,
        ).exists()

        assert not OrganizationAccessRequest.objects.filter(
            id=access_request.id,
        ).exists()

        assert len(mail.outbox) == 1

    def test_deny_request(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        user = self.create_user('bar@example.com')
        member = self.create_member(
            organization=organization,
            user=user,
            type=OrganizationMemberType.MEMBER,
            has_global_access=False,
        )
        team = self.create_team(name='foo', organization=organization)

        access_request = OrganizationAccessRequest.objects.create(
            member=member,
            team=team,
        )

        path = reverse('sentry-api-0-organization-access-request-details', args=[organization.slug, access_request.id])

        self.login_as(self.user)

        resp = self.client.put(path, data={'isApproved': 0})

        assert resp.status_code == 204

        assert not OrganizationMemberTeam.objects.filter(
            organizationmember=member,
            team=team,
            is_active=True,
        ).exists()

        assert not OrganizationAccessRequest.objects.filter(
            id=access_request.id,
        ).exists()
