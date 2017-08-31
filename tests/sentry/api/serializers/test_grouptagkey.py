from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.models import GroupTagKey, TagKey
from sentry.testutils import TestCase


class GroupTagKeySerializerTest(TestCase):
    def test(self):
        user = self.create_user()
        project = self.create_project()
        tagkey = TagKey.objects.create(
            project_id=project.id,
            key='key'
        )
        grouptagkey = GroupTagKey.objects.create(
            project_id=project.id,
            group_id=self.create_group(project=project).id,
            key=tagkey.key
        )

        result = serialize(grouptagkey, user)
        assert result['id'] == six.text_type(grouptagkey.id)
        assert result['key'] == 'key'
