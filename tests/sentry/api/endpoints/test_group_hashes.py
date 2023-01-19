import copy
from urllib.parse import urlencode

from sentry.eventstream.snuba import SnubaEventStream
from sentry.models import GroupHash
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class GroupHashesTest(APITestCase, SnubaTestCase):
    def test_only_return_latest_event(self):
        self.login_as(user=self.user)

        min_ago = iso_format(before_now(minutes=1))
        two_min_ago = iso_format(before_now(minutes=2))
        new_event_id = "b" * 32

        old_event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": two_min_ago,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        new_event = self.store_event(
            data={
                "event_id": new_event_id,
                "message": "message",
                "timestamp": min_ago,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        assert new_event.group_id == old_event.group_id

        url = f"/api/0/issues/{new_event.group_id}/hashes/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["latestEvent"]["eventID"] == new_event_id

    def test_return_multiple_hashes(self):
        self.login_as(user=self.user)

        min_ago = iso_format(before_now(minutes=1))
        two_min_ago = iso_format(before_now(minutes=2))

        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": two_min_ago,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "message2",
                "timestamp": min_ago,
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )

        # Merge the events
        eventstream = SnubaEventStream()
        state = eventstream.start_merge(self.project.id, [event2.group_id], event1.group_id)

        eventstream.end_merge(state)

        url = f"/api/0/issues/{event1.group_id}/hashes/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2

        primary_hashes = [hash["id"] for hash in response.data]
        assert primary_hashes == [event2.get_primary_hash(), event1.get_primary_hash()]

    def test_unmerge(self):
        self.login_as(user=self.user)

        group = self.create_group()

        hashes = [
            GroupHash.objects.create(project=group.project, group=group, hash=hash)
            for hash in ["a" * 32, "b" * 32]
        ]

        url = "?".join(
            [
                f"/api/0/issues/{group.id}/hashes/",
                urlencode({"id": [h.hash for h in hashes]}, True),
            ]
        )

        response = self.client.delete(url, format="json")
        assert response.status_code == 202, response.content
