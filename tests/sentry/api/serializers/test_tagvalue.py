# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.models import EventUser, TagValue
from sentry.testutils import TestCase


class TagValueSerializerTest(TestCase):
    def test_with_user(self):
        user = self.create_user()
        project = self.create_project()
        euser = EventUser.objects.create(
            project=project,
            email='foo@example.com',
        )
        tagvalue = TagValue.objects.create(
            project=project,
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
        tagvalue = TagValue.objects.create(
            project=project,
            key='sentry:user',
            value='email:foo@example.com',
        )

        result = serialize(tagvalue, user)
        assert result['id'] == six.text_type(tagvalue.id)
        assert result['key'] == 'user'
        assert result['value'] == tagvalue.value
        assert result['name'] == tagvalue.get_label()
