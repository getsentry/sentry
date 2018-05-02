from __future__ import absolute_import

import six

from sentry import tagstore
from sentry.api.serializers import serialize
from sentry.testutils import TestCase


class GroupTagKeySerializerTest(TestCase):
    def test(self):
        user = self.create_user()
        project = self.create_project()
        tagkey = tagstore.create_tag_key(
            project_id=project.id,
            environment_id=self.environment.id,
            key='key'
        )
        grouptagkey = tagstore.create_group_tag_key(
            project_id=project.id,
            group_id=self.create_group(project=project).id,
            environment_id=self.environment.id,
            key=tagkey.key
        )

        result = serialize(grouptagkey, user)
        assert result['id'] == six.text_type(grouptagkey.id)
        assert result['key'] == 'key'
