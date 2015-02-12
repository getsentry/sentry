from __future__ import absolute_import

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
