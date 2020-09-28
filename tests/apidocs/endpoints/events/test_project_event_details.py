# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from sentry.testutils.helpers.datetime import before_now, iso_format
from tests.apidocs.util import APIDocsTestCase


class ProjectEventDetailsDocs(APIDocsTestCase):
    endpoint = "sentry-api-0-project-event-details"

    def setUp(self):
        project = self.create_project()

        one_min_ago = iso_format(before_now(minutes=1))
        two_min_ago = iso_format(before_now(minutes=2))
        three_min_ago = iso_format(before_now(minutes=3))
        four_min_ago = iso_format(before_now(minutes=4))

        self.prev_event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": four_min_ago, "fingerprint": ["group-1"]},
            project_id=project.id,
        )
        self.cur_event = self.store_event(
            data={"event_id": "b" * 32, "timestamp": three_min_ago, "fingerprint": ["group-1"]},
            project_id=project.id,
        )
        self.next_event = self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": two_min_ago,
                "fingerprint": ["group-1"],
                "environment": "production",
                "tags": {"environment": "production"},
            },
            project_id=project.id,
        )

        # Event in different group
        self.store_event(
            data={
                "event_id": "d" * 32,
                "timestamp": one_min_ago,
                "fingerprint": ["group-2"],
                "environment": "production",
                "tags": {"environment": "production"},
            },
            project_id=project.id,
        )

        self.url = reverse(
            self.endpoint,
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "event_id": self.cur_event.event_id,
            },
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
