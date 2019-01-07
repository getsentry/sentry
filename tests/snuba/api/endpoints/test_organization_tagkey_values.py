from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase


class OrganizationTagKeyValuesTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationTagKeyValuesTest, self).setUp()
        self.min_ago = timezone.now() - timedelta(minutes=1)
        self.day_ago = timezone.now() - timedelta(days=1)

    def test_simple(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        group = self.create_group(project=project)

        self.create_event(
            'a' * 32, group=group, datetime=self.day_ago, tags={'fruit': 'apple'}
        )
        self.create_event(
            'b' * 32, group=group, datetime=self.min_ago, tags={'fruit': 'orange'}
        )
        self.create_event(
            'c' * 32, group=group, datetime=self.min_ago, tags={'some_tag': 'some_value'}
        )
        self.create_event(
            'd' * 32, group=group, datetime=self.min_ago, tags={'fruit': 'orange'}
        )

        url = reverse(
            'sentry-api-0-organization-tagkey-values',
            kwargs={
                'organization_slug': org.slug,
                'key': 'fruit',
            }
        )

        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content

        assert [(val['value'], val['count'])
                for val in response.data] == [('orange', 2), ('apple', 1)]

    def test_bad_key(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        url = reverse(
            'sentry-api-0-organization-tagkey-values',
            kwargs={
                'organization_slug': org.slug,
                'key': 'fr uit',
            }
        )

        response = self.client.get(url, format='json')
        assert response.status_code == 400, response.content
        assert response.data == {'detail': 'Invalid tag key format for "fr uit"'}

    def test_snuba_column(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        group = self.create_group(project=project)

        self.create_event(
            'a' * 32, group=group, datetime=self.day_ago, user={'email': 'foo@example.com'},
        )
        self.create_event(
            'b' * 32, group=group, datetime=self.min_ago, user={'email': 'bar@example.com'},
        )
        self.create_event(
            'c' * 32, group=group, datetime=timezone.now() - timedelta(seconds=10), user={'email': 'baz@example.com'},
        )
        self.create_event(
            'd' * 32, group=group, datetime=timezone.now() - timedelta(seconds=10), user={'email': 'baz@example.com'},
        )

        url = reverse(
            'sentry-api-0-organization-tagkey-values',
            kwargs={
                'organization_slug': org.slug,
                'key': 'user.email',
            }
        )

        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert [(val['value'], val['count'])
                for val in response.data] == [('baz@example.com', 2), ('bar@example.com', 1), ('foo@example.com', 1)]

    def test_release(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        group = self.create_group(project=project)

        self.create_event(
            'a' * 32, group=group, datetime=self.day_ago, tags={'sentry:release': '3.1.2'},
        )
        self.create_event(
            'b' * 32, group=group, datetime=self.min_ago, tags={'sentry:release': '4.1.2'},
        )
        self.create_event(
            'c' * 32, group=group, datetime=self.day_ago, tags={'sentry:release': '3.1.2'},
        )
        self.create_event(
            'd' * 32, group=group, datetime=timezone.now() - timedelta(seconds=10), tags={'sentry:release': '5.1.2'},
        )

        url = reverse(
            'sentry-api-0-organization-tagkey-values',
            kwargs={
                'organization_slug': org.slug,
                'key': 'release',
            }
        )

        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert [(val['value'], val['count'])
                for val in response.data] == [('5.1.2', 1), ('4.1.2', 1), ('3.1.2', 2)]

    def test_project_id(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])
        other_org = self.create_organization()

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        group = self.create_group(project=project)

        other_project = self.create_project(organization=other_org)
        other_group = self.create_group(project=other_project)

        self.create_event('a' * 32, group=group, datetime=self.day_ago)
        self.create_event('b' * 32, group=group, datetime=self.min_ago)
        self.create_event('c' * 32, group=other_group, datetime=self.day_ago)

        url = reverse(
            'sentry-api-0-organization-tagkey-values',
            kwargs={
                'organization_slug': org.slug,
                'key': 'project.id',
            }
        )

        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_array_column(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        group = self.create_group(project=project)

        self.create_event('a' * 32, group=group, datetime=self.day_ago)
        self.create_event('b' * 32, group=group, datetime=self.min_ago)
        self.create_event('c' * 32, group=group, datetime=self.day_ago)

        url = reverse(
            'sentry-api-0-organization-tagkey-values',
            kwargs={
                'organization_slug': org.slug,
                'key': 'error.type',
            }
        )

        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content

    def test_no_projects(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.login_as(user=user)
        url = reverse(
            'sentry-api-0-organization-tagkey-values',
            kwargs={
                'organization_slug': org.slug,
                'key': 'fruit',
            }
        )

        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 0
