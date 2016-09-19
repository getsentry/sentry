from __future__ import absolute_import

from mock import patch

from django.core.urlresolvers import reverse
from django.core import mail

from sentry.models import Organization, OrganizationStatus
from sentry.testutils import TestCase, PermissionTestCase


class RemoveOrganizationPermissionTest(PermissionTestCase):
    def setUp(self):
        super(RemoveOrganizationPermissionTest, self).setUp()
        self.path = reverse('sentry-remove-organization', args=[self.organization.slug])

    def test_teamless_admin_cannot_load(self):
        self.assert_teamless_admin_cannot_access(self.path)

    def test_team_admin_cannot_load(self):
        self.assert_team_admin_cannot_access(self.path)

    def test_owner_can_load(self):
        self.assert_owner_can_access(self.path)


class RemoveOrganizationTest(TestCase):
    def setUp(self):
        super(RemoveOrganizationTest, self).setUp()

        self.organization = self.create_organization(name='foo', owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.path = reverse('sentry-remove-organization', args=[self.organization.slug])

        self.login_as(self.user)

    def test_renders_with_context(self):
        resp = self.client.get(self.path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/remove-organization.html')

        assert resp.context['organization'] == self.organization
        assert resp.context['form']
        assert resp.context['team_list']

    @patch('sentry.web.frontend.remove_organization.uuid4')
    @patch('sentry.web.frontend.remove_organization.delete_organization')
    def test_success(self, mock_delete_organization, mock_uuid4):
        class uuid(object):
            hex = 'abc123'

        mock_uuid4.return_value = uuid

        owners = self.organization.get_owners()
        assert len(owners) > 0

        with self.tasks():
            resp = self.client.post(self.path)

        assert resp.status_code == 302

        org = Organization.objects.get(id=self.organization.id)

        assert org.status == OrganizationStatus.PENDING_DELETION

        mock_delete_organization.apply_async.assert_called_once_with(
            kwargs={
                'object_id': org.id,
                'transaction_id': 'abc123',
            },
            countdown=86400,
        )

        # Make sure we've emailed all owners
        assert len(mail.outbox) == len(owners)
        owner_emails = set(o.email for o in owners)
        for msg in mail.outbox:
            assert 'Deletion' in msg.subject
            assert len(msg.to) == 1
            owner_emails.remove(msg.to[0])
        # No owners should be remaining
        assert len(owner_emails) == 0

    def test_cannot_remove_default(self):
        Organization.objects.all().delete()

        org = self.create_organization()

        self.login_as(self.user)

        with self.settings(SENTRY_SINGLE_ORGANIZATION=True):
            resp = self.client.post(self.path)

        assert resp.status_code == 302

        organization = Organization.objects.get(id=org.id)

        assert organization.status == OrganizationStatus.VISIBLE
