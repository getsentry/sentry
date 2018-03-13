# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry import tagstore
from sentry.api.serializers import serialize
from sentry.models import EventUser
from sentry.testutils import TestCase


class GroupTagValueSerializerTest(TestCase):
    def test_with_user(self):
        user = self.create_user()
        project = self.create_project()
        euser = EventUser.objects.create(
            project_id=project.id,
            email='foo@example.com',
        )
        tagvalue = tagstore.create_tag_value(
            project_id=project.id,
            environment_id=self.environment.id,
            key='sentry:user',
            value=euser.tag_value,
        )
        grouptagvalue = tagstore.create_group_tag_value(
            project_id=project.id,
            group_id=self.create_group(project=project).id,
            environment_id=self.environment.id,
            key=tagvalue.key,
            value=tagvalue.value,
        )

        result = serialize(grouptagvalue, user)
        assert result['id'] == six.text_type(grouptagvalue.id)
        assert result['key'] == 'user'
        assert result['value'] == grouptagvalue.value
        assert result['name'] == euser.get_label()
