# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.test.client import RequestFactory

from tests.apidocs.util import APIDocsTestCase


class GroupTagKeyValuesDocs(APIDocsTestCase):
    def setUp(self):
        key, value = "foo", "bar"
        event = self.create_event("a", tags={key: value})

        self.login_as(user=self.user)

        self.url = u"/api/0/issues/{}/tags/{}/values/".format(event.group_id, key)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
