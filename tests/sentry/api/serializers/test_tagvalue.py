# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry import tagstore
from sentry.api.serializers import serialize
from sentry.models import EventUser
from sentry.testutils import TestCase


class TagValueSerializerTest(TestCase):
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

        result = serialize(tagvalue, user)
        assert result['id'] == six.text_type(tagvalue.id)
        assert result['key'] == 'user'
        assert result['value'] == tagvalue.value
        assert result['name'] == euser.get_label()

    def test_basic(self):
        user = self.create_user()
        project = self.create_project()
        tagvalue = tagstore.create_tag_value(
            project_id=project.id,
            environment_id=self.environment.id,
            key='sentry:user',
            value='email:foo@example.com',
        )

        result = serialize(tagvalue, user)
        assert result['id'] == six.text_type(tagvalue.id)
        assert result['key'] == 'user'
        assert result['value'] == tagvalue.value
        assert result['name'] == tagvalue.get_label()

    def test_release(self):
        user = self.create_user()
        project = self.create_project()
        tagvalue = tagstore.create_tag_value(
            project_id=project.id,
            environment_id=self.environment.id,
            key='sentry:release',
            value='df84bccbb23ca15f2868be1f2a5f7c7a6464fadd',
        )

        result = serialize(tagvalue, user)
        assert result['id'] == six.text_type(tagvalue.id)
        assert result['key'] == 'release'
        assert result['value'] == tagvalue.value
        assert result['name'] == tagvalue.get_label()
