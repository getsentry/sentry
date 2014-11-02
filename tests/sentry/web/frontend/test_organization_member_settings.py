from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import OrganizationMember, OrganizationMemberType
from sentry.testutils import TestCase


class OrganizationMemberSettingsTest(TestCase):
    def test_renders_with_context(self):
        organization = self.create_organization(name='foo', owner=self.user)
        team_1 = self.create_team(name='foo', organization=organization)
        team_2 = self.create_team(name='bar', organization=organization)

        user = self.create_user('bar@example.com')
        member = OrganizationMember.objects.create(
            organization=organization,
            user=user,
            type=OrganizationMemberType.MEMBER,
            has_global_access=False,
        )
        member.teams.add(team_2)

        path = reverse('sentry-organization-member-settings', args=[organization.id, member.id])

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/organization-member-settings.html')

        assert resp.context['organization'] == organization
        assert resp.context['member'] == member
        assert resp.context['form']
