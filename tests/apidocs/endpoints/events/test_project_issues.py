# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.test.client import RequestFactory

from sentry.testutils.helpers.datetime import before_now, iso_format
from tests.apidocs.util import APIDocsTestCase


class ProjectIssuesDocs(APIDocsTestCase):
    def setUp(self):
        project = self.create_project()

        for _ in range(2):
            self.store_event(
                data={"timestamp": iso_format(before_now(minutes=1))}, project_id=project.id
            )

        self.url = u"/api/0/projects/{}/{}/issues/".format(project.organization.slug, project.slug)

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_put(self):
        data = {"isPublic": False, "status": "unresolved", "statusDetails": {}}
        response = self.client.put(self.url, data)
        request = RequestFactory().put(self.url, data)

        self.validate_schema(request, response)

    def test_delete(self):
        response = self.client.delete(self.url)
        request = RequestFactory().delete(self.url)

        self.validate_schema(request, response)
