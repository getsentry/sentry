from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import (
    Organization, OrganizationMember, OrganizationMemberType,
    OrganizationStatus, User
)
from sentry.testutils import TestCase


class RemoveAccountTest(TestCase):
    def setUp(self):
        super(RemoveAccountTest, self).setUp()

        other_user = self.create_user('bar@example.com')

        # single owner org
        self.organization = self.create_organization(name='a', owner=self.user)
        self.create_member(
            user=other_user,
            organization=self.organization,
            type=OrganizationMemberType.ADMIN,
            has_global_access=True,
        )
        # dual owner
        self.organization2 = self.create_organization(name='b', owner=self.user)
        self.create_member(
            organization=self.organization2,
            type=OrganizationMemberType.OWNER,
            has_global_access=True,
            user=other_user,
        )

        # non-owned
        self.organization3 = self.create_organization(name='c', owner=other_user)

        self.path = reverse('sentry-remove-account')
        self.login_as(self.user)

    def test_renders_with_context(self):
        resp = self.client.get(self.path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/remove-account.html')

        assert resp.context['organization_results'] == [{
            'organization': self.organization,
            'single_owner': True,
        }, {
            'organization': self.organization2,
            'single_owner': False,
        }]

    def test_implicit_delete(self):
        resp = self.client.post(self.path)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/post-remove-account.html')

        assert not User.objects.get(
            id=self.user.id,
        ).is_active

        # should implicitly remove the first organization, but not the 2nd
        assert Organization.objects.get(
            id=self.organization.id,
        ).status == OrganizationStatus.PENDING_DELETION

        assert Organization.objects.get(
            id=self.organization2.id,
        ).status == OrganizationStatus.VISIBLE
        assert not OrganizationMember.objects.filter(
            user=self.user,
            organization=self.organization2,
        ).exists()

        assert Organization.objects.get(
            id=self.organization3.id,
        ).status == OrganizationStatus.VISIBLE

    def test_explicit_delete(self):
        resp = self.client.post(self.path, data={
            'oID': [self.organization.slug, self.organization2.slug,
                    self.organization3.slug],
        })

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/post-remove-account.html')

        # should implicitly remove the first organization, but not the 2nd
        assert Organization.objects.get(
            id=self.organization.id,
        ).status == OrganizationStatus.PENDING_DELETION

        assert Organization.objects.get(
            id=self.organization2.id,
        ).status == OrganizationStatus.PENDING_DELETION

        assert Organization.objects.get(
            id=self.organization3.id,
        ).status == OrganizationStatus.VISIBLE

    # def test_cannot_remove_default(self):
    #     Organization.objects.all().delete()

    #     org = self.create_organization()

    #     self.login_as(self.user)

    #     url = reverse('sentry-api-0-organization-details', kwargs={
    #         'organization_slug': org.slug,
    #     })

    #     with self.settings(SENTRY_SINGLE_ORGANIZATION=True):
    #         resp = self.client.post(self.path)

    #     assert resp.status_code == 302

    #     organization = Organization.objects.get(id=org.id)

    #     assert organization.status == OrganizationStatus.VISIBLE
