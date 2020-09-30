# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.test.client import RequestFactory

from tests.apidocs.util import APIDocsTestCase


class ProjectGroupEventBase(APIDocsTestCase):
    def setUp(self):
        event = self.create_event("a")
        self.create_event("b")

        self.group_id = event.group.id

        self.login_as(user=self.user)


class ProjectGroupEventsDocs(ProjectGroupEventBase):
    def setUp(self):
        super(ProjectGroupEventsDocs, self).setUp()
        self.url = u"/api/0/issues/{}/events/".format(self.group_id)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)


class ProjectGroupEventsLatestDocs(ProjectGroupEventBase):
    def setUp(self):
        super(ProjectGroupEventsLatestDocs, self).setUp()
        self.url = u"/api/0/issues/{}/events/latest/".format(self.group_id)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)


class ProjectGroupEventsOldestDocs(ProjectGroupEventBase):
    def setUp(self):
        super(ProjectGroupEventsOldestDocs, self).setUp()
        self.url = u"/api/0/issues/{}/events/oldest/".format(self.group_id)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
