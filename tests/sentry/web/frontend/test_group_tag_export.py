from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.models import GroupTagValue, TagKey, TagValue
from sentry.testutils import TestCase


class GroupTagExportTest(TestCase):
    def test_simple(self):
        key, value1, value2 = 'foo', 'bar  ', '=2*2'

        # Drop microsecond value for MySQL
        now = timezone.now().replace(microsecond=0)

        project = self.create_project()
        group = self.create_group(project=project)
        TagKey.objects.create(project=project, key=key)
        TagValue.objects.create(
            project=project,
            key=key,
            value=value1,
        )
        TagValue.objects.create(
            project=project,
            key=key,
            value=value2,
        )
        group_tag_value1 = GroupTagValue.objects.create(
            project=project,
            group=group,
            key=key,
            value=value1,
            times_seen=1,
            first_seen=now - timedelta(hours=2),
            last_seen=now,
        )
        group_tag_value2 = GroupTagValue.objects.create(
            project=project,
            group=group,
            key=key,
            value=value2,
            times_seen=1,
            first_seen=now - timedelta(hours=1),
            last_seen=now,
        )

        self.login_as(user=self.user)

        url = '/{}/{}/issues/{}/tags/{}/export/'.format(
            project.organization.slug, project.slug, group.id, key
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
            elif idx == 1:
                assert bits[0] == "'=2*2"
                assert bits[1] == '1'
                assert bits[2] == group_tag_value2.last_seen.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
                assert bits[3] == group_tag_value2.first_seen.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
            elif idx == 2:
                assert bits[0] == 'bar'
                assert bits[1] == '1'
                assert bits[2] == group_tag_value1.last_seen.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
                assert bits[3] == group_tag_value1.first_seen.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
            else:
                assert False, 'Too many rows!'
