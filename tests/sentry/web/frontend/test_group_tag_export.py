from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.testutils import (
    SnubaTestCase,
    TestCase,
)


class GroupTagExportTest(TestCase, SnubaTestCase):
    def test_simple(self):
        key, value = 'foo', u'b\xe4r'

        project = self.create_project()
        first_event = self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'environment': self.environment.name,
                'timestamp': (timezone.now() - timedelta(hours=1)).isoformat()[:19],
                'tags': {key: value},
            },
            project_id=project.id,
        )
        last_event = self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'environment': self.environment.name,
                'timestamp': (timezone.now() - timedelta(minutes=5)).isoformat()[:19],
                'tags': {key: value},
            },
            project_id=project.id,
        )
        group = first_event.group

        self.login_as(user=self.user)

        url = u'/{}/{}/issues/{}/tags/{}/export/?environment={}'.format(
            project.organization.slug, project.slug, group.id, key, self.environment.name
        )

        response = self.client.get(url)

        assert response.status_code == 200
        assert response.streaming
        assert response['Content-Type'] == 'text/csv'
        rows = list(response.streaming_content)
        for idx, row in enumerate(rows):
            row = row.decode('utf-8')
            assert row.endswith(u'\r\n')
            bits = row[:-2].split(',')
            if idx == 0:
                assert bits == ['value', 'times_seen', 'last_seen', 'first_seen']
            else:
                assert bits[0] == value
                assert bits[1] == '2'
                assert bits[2] == last_event.datetime.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
                assert bits[3] == first_event.datetime.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
