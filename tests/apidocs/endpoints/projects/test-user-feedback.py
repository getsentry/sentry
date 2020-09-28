# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.test.client import RequestFactory
from django.utils import timezone

from tests.apidocs.util import APIDocsTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class ProjectUserFeedbackDocs(APIDocsTestCase):
    def setUp(self):
        organization = self.create_organization()
        project = self.create_project(name="foo", organization=organization, teams=[])
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": iso_format(before_now(seconds=1)),
            },
            project_id=project.id,
        )
        group = self.create_group(project=project, message="Foo bar")
        self.create_userreport(
            date_added=timezone.now(), group=group, project=project, event_id=event.event_id,
        )

        self.url = u"/api/0/projects/{}/{}/user-feedback/".format(organization.slug, project.slug)

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_post(self):
        data = {
            "event_id": self.event.event_id,
            "name": "Hellboy",
            "email": "hellboy@sentry.io",
            "comments": "It broke!",
        }
        response = self.client.post(self.url, data)
        request = RequestFactory().post(self.url, data)

        self.validate_schema(request, response)
