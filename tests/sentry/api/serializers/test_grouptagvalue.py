# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.models import EventUser, GroupTagValue, TagValue
from sentry.testutils import TestCase


class GroupTagValueSerializerTest(TestCase):
    def test_with_user(self):
        user = self.create_user()
        project = self.create_project()
        euser = EventUser.objects.create(
            project_id=project.id,
            email='foo@example.com',
        )
        tagvalue = TagValue.objects.create(
            project_id=project.id,
            key='sentry:user',
            value=euser.tag_value,
        )
        grouptagvalue = GroupTagValue.objects.create(
            project_id=project.id,
            group_id=self.create_group(project=project).id,
            key=tagvalue.key,
            value=tagvalue.value,
        )

        result = serialize(grouptagvalue, user)
        assert result['id'] == six.text_type(grouptagvalue.id)
        assert result['key'] == 'user'
        assert result['value'] == grouptagvalue.value
        assert result['name'] == euser.get_label()

    def test_with_no_tagvalue(self):
        user = self.create_user()
        project = self.create_project()
        grouptagvalue = GroupTagValue.objects.create(
            project_id=project.id,
            group_id=self.create_group(project=project).id,
            key='sentry:user',
            value='email:foo@example.com',
        )

        result = serialize(grouptagvalue, user)
        assert result['id'] == six.text_type(grouptagvalue.id)
        assert result['key'] == 'user'
        assert result['value'] == grouptagvalue.value
        assert result['name'] == grouptagvalue.value
