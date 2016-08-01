from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.models import GroupTagValue, TagKey, TagValue
from sentry.testutils import TestCase


class GroupTagExportTest(TestCase):
    def test_simple(self):
        key, value = 'foo', 'bar'

        # Drop microsecond value for MySQL
        now = timezone.now().replace(microsecond=0)

        project = self.create_project()
        group = self.create_group(project=project)
        TagKey.objects.create(project=project, key=key)
        TagValue.objects.create(
            project=project,
            key=key,
            value=value,
        )
        group_tag_value = GroupTagValue.objects.create(
            project=project,
            group=group,
            key=key,
            value=value,
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
            else:
                assert bits[0] == value
                assert bits[1] == '1'
                assert bits[2] == group_tag_value.last_seen.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
                assert bits[3] == group_tag_value.first_seen.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
