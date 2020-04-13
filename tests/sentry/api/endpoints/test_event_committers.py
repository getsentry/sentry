from __future__ import absolute_import

import copy

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.utils.samples import load_data

# TODO(dcramer): These tests rely too much on implicit fixtures


class EventCommittersTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()

        release = self.create_release(project, self.user)
        min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={
                "fingerprint": ["group1"],
                "timestamp": min_ago,
                "release": release.version,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
            },
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-event-file-committers",
            kwargs={
                "event_id": event.event_id,
                "project_slug": event.project.slug,
                "organization_slug": event.project.organization.slug,
            },
        )

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data["committers"]) == 1
        assert response.data["committers"][0]["author"]["username"] == "admin@localhost"
        assert len(response.data["committers"][0]["commits"]) == 1
        assert (
            response.data["committers"][0]["commits"][0]["message"] == "placeholder commit message"
        )

        # assert len(response.data['annotatedFrames']) == 1
        # assert len(response.data['annotatedFrames'][0]['commits']) == 1
        # assert response.data['annotatedFrames'][0]['commits'][0]['author']['username'
        #                                                                    ] == 'admin@localhost'
        # TODO(maxbittker) test more edge cases here

    def test_no_group(self):
        self.login_as(user=self.user)

        project = self.create_project()

        min_ago = iso_format(before_now(minutes=1))
        event_data = load_data("transaction")
        event_data["start_timestamp"] = min_ago
        event_data["timestamp"] = min_ago

        event = self.store_event(data=event_data, project_id=project.id)

        url = reverse(
            "sentry-api-0-event-file-committers",
            kwargs={
                "event_id": event.event_id,
                "project_slug": event.project.slug,
                "organization_slug": event.project.organization.slug,
            },
        )

        response = self.client.get(url, format="json")
        assert response.status_code == 404, response.content
        assert response.data["detail"] == "Issue not found"

    def test_no_release(self):
        self.login_as(user=self.user)

        project = self.create_project()

        min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": min_ago}, project_id=project.id
        )

        url = reverse(
            "sentry-api-0-event-file-committers",
            kwargs={
                "event_id": event.event_id,
                "project_slug": event.project.slug,
                "organization_slug": event.project.organization.slug,
            },
        )

        response = self.client.get(url, format="json")
        assert response.status_code == 404, response.content
        assert response.data["detail"] == "Release not found"

    def test_null_stacktrace(self):
        self.login_as(user=self.user)

        project = self.create_project()

        release = self.create_release(project, self.user)

        min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={
                "fingerprint": ["group1"],
                "environment": "production",
                "type": "default",
                "exception": {
                    "values": [
                        {
                            "type": "ValueError",
                            "value": "My exception value",
                            "module": "__builtins__",
                            "stacktrace": None,
                        }
                    ]
                },
                "tags": [["environment", "production"], ["sentry:release", release.version]],
                "release": release.version,
                "timestamp": min_ago,
            },
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-event-file-committers",
            kwargs={
                "event_id": event.event_id,
                "project_slug": event.project.slug,
                "organization_slug": event.project.organization.slug,
            },
        )

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
