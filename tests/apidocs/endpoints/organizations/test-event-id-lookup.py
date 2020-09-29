# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from tests.apidocs.util import APIDocsTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class OrganizationEventIDLookupDocs(APIDocsTestCase):
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
        self.url = reverse(
            "sentry-api-0-event-id-lookup",
            kwargs={"organization_slug": organization.slug, "event_id": event.event_id},
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
