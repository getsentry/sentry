# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.test.client import RequestFactory

from tests.apidocs.util import APIDocsTestCase


class ProjectGroupHashesDocs(APIDocsTestCase):
    def setUp(self):
        self.create_event("a")
        event = self.create_event("b")

        self.url = u"/api/0/issues/{}/hashes/".format(event.group_id)

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
