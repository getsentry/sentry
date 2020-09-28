# -*- coding: utf-8 -*-

from __future__ import absolute_import

import copy
from django.test.client import RequestFactory

from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.testutils.helpers.datetime import before_now, iso_format
from tests.apidocs.util import APIDocsTestCase


class ProjectGroupHashesDocs(APIDocsTestCase):
    def setUp(self):
        min_ago = iso_format(before_now(minutes=1))
        two_min_ago = iso_format(before_now(minutes=2))
        new_event_id = "b" * 32

        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": two_min_ago,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        event = self.store_event(
            data={
                "event_id": new_event_id,
                "message": "message",
                "timestamp": min_ago,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        self.url = u"/api/0/issues/{}/hashes/".format(event.group_id)

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
