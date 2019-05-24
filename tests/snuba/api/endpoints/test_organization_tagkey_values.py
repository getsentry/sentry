from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse
from exam import fixture

from sentry.testutils import APITestCase, SnubaTestCase


class OrganizationTagKeyValuesTest(APITestCase, SnubaTestCase):
    endpoint = 'sentry-api-0-organization-tagkey-values'

    def setUp(self):
        super(OrganizationTagKeyValuesTest, self).setUp()
        self.min_ago = timezone.now() - timedelta(minutes=1)
        self.day_ago = timezone.now() - timedelta(days=1)
        user = self.create_user()
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        self.create_member(organization=self.org, user=user, teams=[self.team])
        self.login_as(user=user)

    def get_response(self, key, **kwargs):
        return super(OrganizationTagKeyValuesTest, self).get_response(self.org.slug, key)

    def run_test(self, key, expected):
        response = self.get_valid_response(key)
        assert [(val['value'], val['count']) for val in response.data] == expected

    @fixture
    def project(self):
        return self.create_project(organization=self.org, teams=[self.team])

    @fixture
    def group(self):
        return self.create_group(project=self.project)

    def test_simple(self):
        self.create_event(
            event_id='a' * 32, group=self.group, datetime=self.day_ago, tags={'fruit': 'apple'}
        )
        self.create_event(
            event_id='b' * 32, group=self.group, datetime=self.min_ago, tags={'fruit': 'orange'}
        )
        self.create_event(
            event_id='c' * 32, group=self.group, datetime=self.min_ago, tags={'some_tag': 'some_value'}
        )
        self.create_event(
            event_id='d' * 32, group=self.group, datetime=self.min_ago, tags={'fruit': 'orange'}
        )

        url = reverse(
            'sentry-api-0-organization-tagkey-values',
            kwargs={
                'organization_slug': self.org.slug,
                'key': 'fruit',
            }
        )
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        self.run_test('fruit', expected=[('orange', 2), ('apple', 1)])

    def test_bad_key(self):
        response = self.get_response('fr uit')
        assert response.status_code == 400, response.content
        assert response.data == {'detail': 'Invalid tag key format for "fr uit"'}

    def test_snuba_column(self):
        self.create_event(
            event_id='a' * 32, group=self.group, datetime=self.day_ago, user={'email': 'foo@example.com'},
        )
        self.create_event(
            event_id='b' * 32, group=self.group, datetime=self.min_ago, user={'email': 'bar@example.com'},
        )
        self.create_event(
            event_id='c' * 32, group=self.group, datetime=timezone.now() - timedelta(seconds=10), user={'email': 'baz@example.com'},
        )
        self.create_event(
            event_id='d' * 32, group=self.group, datetime=timezone.now() - timedelta(seconds=10), user={'email': 'baz@example.com'},
        )
        self.run_test(
            'user.email',
            expected=[('baz@example.com', 2), ('bar@example.com', 1), ('foo@example.com', 1)],
        )

    def test_release(self):
        self.create_event(
            event_id='a' * 32, group=self.group, datetime=self.day_ago, tags={'sentry:release': '3.1.2'},
        )
        self.create_event(
            event_id='b' * 32, group=self.group, datetime=self.min_ago, tags={'sentry:release': '4.1.2'},
        )
        self.create_event(
            event_id='c' * 32, group=self.group, datetime=self.day_ago, tags={'sentry:release': '3.1.2'},
        )
        self.create_event(
            event_id='d' * 32, group=self.group, datetime=timezone.now() - timedelta(seconds=10), tags={'sentry:release': '5.1.2'},
        )
        self.run_test('release', expected=[('5.1.2', 1), ('4.1.2', 1), ('3.1.2', 2)])

    def test_user_tag(self):
        self.create_event(
            event_id='a' * 32, group=self.group, datetime=self.day_ago, tags={'sentry:user': '1'},
        )
        self.create_event(
            event_id='b' * 32, group=self.group, datetime=self.min_ago, tags={'sentry:user': '2'},
        )
        self.create_event(
            event_id='c' * 32, group=self.group, datetime=self.day_ago, tags={'sentry:user': '1'},
        )
        self.create_event(
            event_id='d' * 32, group=self.group, datetime=timezone.now() - timedelta(seconds=10), tags={'sentry:user': '3'},
        )
        self.run_test('user', expected=[('3', 1), ('2', 1), ('1', 2)])

    def test_project_id(self):
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_group = self.create_group(project=other_project)

        self.create_event(event_id='a' * 32, group=self.group, datetime=self.day_ago)
        self.create_event(event_id='b' * 32, group=self.group, datetime=self.min_ago)
        self.create_event(event_id='c' * 32, group=other_group, datetime=self.day_ago)
        self.run_test('project.id', expected=[])

    def test_array_column(self):
        self.create_event(event_id='a' * 32, group=self.group, datetime=self.day_ago)
        self.create_event(event_id='b' * 32, group=self.group, datetime=self.min_ago)
        self.create_event(event_id='c' * 32, group=self.group, datetime=self.day_ago)
        self.run_test('error.type', expected=[])

    def test_no_projects(self):
        self.run_test('fruit', expected=[])
