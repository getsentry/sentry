from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import OrganizationMember, OrganizationMemberTeam, Team
from sentry.testutils import APITestCase


class OrganizationTeamsListTest(APITestCase):
    def test_simple(self):
        user = self.create_user()
        org = self.create_organization(owner=self.user)
        team1 = self.create_team(organization=org, name='foo')
        team2 = self.create_team(organization=org, name='bar')

        self.create_member(
            organization=org,
            user=user,
            has_global_access=False,
            teams=[team1],
        )

        path = reverse('sentry-api-0-organization-teams', args=[org.slug])

        self.login_as(user=user)

        response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]['id'] == six.text_type(team2.id)
        assert not response.data[0]['isMember']
        assert response.data[1]['id'] == six.text_type(team1.id)
        assert response.data[1]['isMember']


class OrganizationTeamsCreateTest(APITestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-0-organization-teams', args=[self.organization.slug])

    def test_missing_permission(self):
        user = self.create_user()
        self.login_as(user=user)
        resp = self.client.post(self.path)
        assert resp.status_code == 403

    def test_missing_params(self):
        self.login_as(user=self.user)
        resp = self.client.post(self.path)
        assert resp.status_code == 400

    def test_valid_params(self):
        self.login_as(user=self.user)

        resp = self.client.post(self.path, data={
            'name': 'hello world',
            'slug': 'foobar',
        })
        assert resp.status_code == 201, resp.content
        team = Team.objects.get(id=resp.data['id'])
        assert team.name == 'hello world'
        assert team.slug == 'foobar'
        assert team.organization == self.organization

        member = OrganizationMember.objects.get(
            user=self.user,
            organization=self.organization,
        )

        assert OrganizationMemberTeam.objects.filter(
            organizationmember=member,
            team=team,
            is_active=True,
        ).exists()

    def test_without_slug(self):
        self.login_as(user=self.user)

        resp = self.client.post(self.path, data={
            'name': 'hello world',
        })
        assert resp.status_code == 201, resp.content
        team = Team.objects.get(id=resp.data['id'])
        assert team.slug == 'hello-world'

    def test_duplicate(self):
        self.login_as(user=self.user)

        resp = self.client.post(self.path, data={
            'name': 'hello world',
            'slug': 'foobar',
        })

        assert resp.status_code == 201, resp.content

        resp = self.client.post(self.path, data={
            'name': 'hello world',
            'slug': 'foobar',
        })

        assert resp.status_code == 409, resp.content
