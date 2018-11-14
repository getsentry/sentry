from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase


class OrganizationTagKeyValuesTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationTagKeyValuesTest, self).setUp()
        self.min_ago = timezone.now() - timedelta(minutes=1)

    def test_simple(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        group = self.create_group(project=project)

        self.create_event(
            'a' * 32, group=group, datetime=self.min_ago, tags={'fruit': 'apple'}
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
        assert response.data == [{'count': 2, 'value': 'orange'}, {'count': 1, 'value': 'apple'}]

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
