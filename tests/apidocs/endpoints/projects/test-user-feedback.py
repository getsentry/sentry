# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.test.client import RequestFactory
from django.utils import timezone

from tests.apidocs.util import APIDocsTestCase


class ProjectUserFeedbackDocs(APIDocsTestCase):
    def setUp(self):
        event = self.create_event("a", message="oh no")
        group = self.create_group(project=self.project, message="Foo bar")
        self.event_id = event.event_id
        self.create_userreport(
            date_added=timezone.now(), group=group, project=self.project, event_id=self.event_id,
        )

        self.url = u"/api/0/projects/{}/{}/user-feedback/".format(
            self.organization.slug, self.project.slug
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_post(self):
        data = {
            "event_id": self.event_id,
            "name": "Hellboy",
            "email": "hellboy@sentry.io",
            "comments": "It broke!",
        }
        response = self.client.post(self.url, data)
        request = RequestFactory().post(self.url, data)

        self.validate_schema(request, response)
