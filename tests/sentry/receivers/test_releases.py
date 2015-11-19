from __future__ import absolute_import

from mock import patch

from sentry.models import Release, TagValue
from sentry.testutils import TestCase


class EnsureReleaseExistsTest(TestCase):
    def test_simple(self):
        tv = TagValue.objects.create(
            project=self.project,
            key='sentry:release',
            value='1.0',
        )

        tv = TagValue.objects.get(id=tv.id)
        assert tv.data['release_id']

        release = Release.objects.get(
            id=tv.data['release_id']
        )
        assert release.version == tv.value
        assert release.project == self.project

        # ensure we dont hit some kind of error saving it again
        tv.save()


class ResolveGroupResolutions(TestCase):
    @patch('sentry.tasks.clear_expired_resolutions.clear_expired_resolutions.delay')
    def test_simple(self, mock_delay):
        release = Release.objects.create(
            version='a',
            project=self.project,
        )

        mock_delay.assert_called_once_with(
            release_id=release.id,
        )
