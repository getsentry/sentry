# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from tests.apidocs.util import APIDocsTestCase
from sentry.models import EventUser


class ProjectUsersDocs(APIDocsTestCase):
    def setUp(self):
        self.project = self.create_project()
        self.euser1 = EventUser.objects.create(
            project_id=self.project.id,
            ident="1",
            email="foo@example.com",
            username="foobar",
            ip_address="127.0.0.1",
        )

        self.euser2 = EventUser.objects.create(
            project_id=self.project.id,
            ident="2",
            email="bar@example.com",
            username="baz",
            ip_address="192.168.0.1",
        )
        self.url = reverse(
            "sentry-api-0-project-users",
            kwargs={"organization_slug": self.organization.slug, "project_slug": self.project.slug},
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
