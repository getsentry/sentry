from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import OrganizationMember, OrganizationMemberType
from sentry.testutils import APITestCase


class DeleteOrganizationMemberTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        member = self.create_user('bar@example.com')

        member_om = OrganizationMember.objects.create(
            organization=organization,
            user=member,
            type=OrganizationMemberType.MEMBER,
            has_global_access=False,
        )

        path = reverse('sentry-api-0-organization-member-details', args=[organization.slug, member_om.id])

        self.login_as(self.user)

        resp = self.client.delete(path)

        assert resp.status_code == 204

        assert not OrganizationMember.objects.filter(id=member_om.id).exists()

    def test_cannot_delete_only_owner(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)

        owner_om = OrganizationMember.objects.get(
            organization=organization,
            user=self.user,
        )

        path = reverse('sentry-api-0-organization-member-details', args=[organization.slug, owner_om.id])

        self.login_as(self.user)

        resp = self.client.delete(path)

        assert resp.status_code == 403

        assert OrganizationMember.objects.filter(id=owner_om.id).exists()
