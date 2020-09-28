# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.test.client import RequestFactory

from sentry.testutils.helpers.datetime import before_now, iso_format
from tests.apidocs.util import APIDocsTestCase


class GroupTagKeyValuesDocs(APIDocsTestCase):
    def setUp(self):
        key, value = "foo", "bar"

        project = self.create_project()

        event = self.store_event(
            data={"tags": {key: value}, "timestamp": iso_format(before_now(seconds=1))},
            project_id=project.id,
        )
        group = event.group

        self.login_as(user=self.user)

        self.url = u"/api/0/issues/{}/tags/{}/values/".format(group.id, key)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
