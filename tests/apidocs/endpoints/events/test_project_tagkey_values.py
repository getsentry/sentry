# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from sentry.testutils.helpers.datetime import before_now, iso_format
from tests.apidocs.util import APIDocsTestCase


class ProjectTagKeyValuesDocs(APIDocsTestCase):
    def setUp(self):
        project = self.create_project()
        self.store_event(
            data={"tags": {"foo": "bar"}, "timestamp": iso_format(before_now(seconds=1))},
            project_id=project.id,
        )

        self.login_as(user=self.user)

        self.url = reverse(
            "sentry-api-0-project-tagkey-values",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "key": "foo",
            },
        )

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
