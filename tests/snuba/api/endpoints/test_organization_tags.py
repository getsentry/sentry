from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse
from uuid import uuid4

from sentry.testutils import APITestCase, SnubaTestCase


class OrganizationTagsTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationTagsTest, self).setUp()
        self.min_ago = timezone.now() - timedelta(minutes=1)
        self.user = self.create_user()
        self.login_as(user=self.user)
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        self.create_member(organization=self.org, user=self.user, teams=[self.team])

        self.url = reverse(
            'sentry-api-0-organization-tags',
            kwargs={
                'organization_slug': self.org.slug,
            }
        )

    def test_simple(self):
        project = self.create_project(organization=self.org, teams=[self.team])
        group = self.create_group(project=project)

        self.create_event(
            event_id='a' * 32, group=group, datetime=self.min_ago, tags={'fruit': 'apple'}
        )
        self.create_event(
            event_id='b' * 32, group=group, datetime=self.min_ago, tags={'fruit': 'orange'}
        )
        self.create_event(
            event_id='c' * 32, group=group, datetime=self.min_ago, tags={'some_tag': 'some_value'}
        )
        self.create_event(
            event_id='d' * 32, group=group, datetime=self.min_ago, tags={'fruit': 'orange'}
        )

        response = self.client.get(self.url, format='json')
        assert response.status_code == 200, response.content
        data = response.data
        data.sort(key=lambda val: val['totalValues'], reverse=True)
        assert data == [
            {'name': 'Fruit', 'key': 'fruit', 'totalValues': 3},
            {'name': 'Some Tag', 'key': 'some_tag', 'totalValues': 1},
        ]

    def test_no_projects(self):
        org = self.create_organization(owner=self.user)
        url = reverse(
            'sentry-api-0-organization-tags',
            kwargs={
                'organization_slug': org.slug,
            }
        )
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert response.data == []

    def create_event_with_tags(self, group, tags):
        self.create_event(
            event_id=uuid4().hex, group=group, datetime=self.min_ago, tags=tags
        )

    def test_selected_projects(self):
        project = self.create_project(organization=self.org, teams=[self.team])

        group1 = self.create_group(project=project)
        group1_tags = [{'fruit': 'apple'}, {'fruit': 'orange'},
                       {'some_tag': 'some_value'}, {'fruit': 'orange'}]
        for tags in group1_tags:
            self.create_event_with_tags(
                group=group1, tags=tags
            )

        project2 = self.create_project(organization=self.org, teams=[self.team])
        group2 = self.create_group(project=project2)
        group2_tags = [{'fruit': 'apple'},
                       {'some_tag': 'some_value'},
                       {'fruit': 'orange'},
                       {'uniq_tag': 'blah'}]
        for tags in group2_tags:
            self.create_event_with_tags(
                group=group2, tags=tags
            )

        response = self.client.get(
            '%s?project=%d&project=%d' % (self.url, project2.id, project.id),
            format='json'
        )
        assert response.status_code == 200, response.content
        data = response.data
        data.sort(key=lambda val: val['totalValues'], reverse=True)
        assert data == [
            {'name': 'Fruit', 'key': 'fruit', 'totalValues': 5},
            {'name': 'Some Tag', 'key': 'some_tag', 'totalValues': 2},
            {'name': 'Uniq Tag', 'key': 'uniq_tag', 'totalValues': 1}
        ]

        response = self.client.get(
            '%s?project=%d' % (self.url, project2.id),
            format='json'
        )
        assert response.status_code == 200, response.content
        data = response.data
        data.sort(key=lambda val: val['totalValues'], reverse=True)
        assert data == [
            {'name': 'Fruit', 'key': 'fruit', 'totalValues': 2},
            {'name': 'Uniq Tag', 'key': 'uniq_tag', 'totalValues': 1},
            {'name': 'Some Tag', 'key': 'some_tag', 'totalValues': 1},
        ]
