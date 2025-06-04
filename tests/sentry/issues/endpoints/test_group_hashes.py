from unittest.mock import patch
from urllib.parse import urlencode

from sentry.eventstream.snuba import SnubaEventStream
from sentry.models.grouphash import GroupHash
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now


class GroupHashesTest(APITestCase, SnubaTestCase):
    def test_only_return_latest_event(self) -> None:
        self.login_as(user=self.user)

        min_ago = before_now(minutes=1).isoformat()
        two_min_ago = before_now(minutes=2).isoformat()
        new_event_id = "b" * 32

        old_event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": two_min_ago,
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        new_event = self.store_event(
            data={
                "event_id": new_event_id,
                "message": "message",
                "timestamp": min_ago,
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

    def test_return_multiple_hashes(self) -> None:
        self.login_as(user=self.user)

        min_ago = before_now(minutes=1).isoformat()
        two_min_ago = before_now(minutes=2).isoformat()

        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": two_min_ago,
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
        assert state is not None

        eventstream.end_merge(state)

        url = f"/api/0/issues/{event1.group_id}/hashes/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2

        primary_hashes = [hash["id"] for hash in response.data]
        assert primary_hashes == [event2.get_primary_hash(), event1.get_primary_hash()]

    def test_unmerge(self) -> None:
        self.login_as(user=self.user)

        group = self.create_group(
            platform="javascript",
            metadata={"sdk": {"name_normalized": "sentry.javascript.nextjs"}},
        )

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

        with patch("sentry.issues.endpoints.group_hashes.metrics.incr") as mock_metrics_incr:
            response = self.client.put(url, format="json")

            assert response.status_code == 202, response.content
            mock_metrics_incr.assert_any_call(
                "grouping.unmerge_issues",
                sample_rate=1.0,
                tags={"platform": "javascript", "sdk": "sentry.javascript.nextjs"},
            )

    def test_unmerge_put_member(self) -> None:
        member_user = self.create_user(is_superuser=False)
        member = self.create_member(organization=self.organization, user=member_user, role="member")
        self.login_as(user=member)

        group = self.create_group(
            platform="javascript",
            metadata={"sdk": {"name_normalized": "sentry.javascript.nextjs"}},
        )

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

        with patch("sentry.issues.endpoints.group_hashes.metrics.incr") as mock_metrics_incr:
            response = self.client.put(url, format="json")

            assert response.status_code == 202, response.content
            mock_metrics_incr.assert_any_call(
                "grouping.unmerge_issues",
                sample_rate=1.0,
                tags={"platform": "javascript", "sdk": "sentry.javascript.nextjs"},
            )

    def test_unmerge_conflict(self) -> None:
        self.login_as(user=self.user)

        group = self.create_group(platform="javascript")

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
        hashes[0].update(state=GroupHash.State.LOCKED_IN_MIGRATION)
        hashes[1].update(state=GroupHash.State.LOCKED_IN_MIGRATION)

        response = self.client.put(url, format="json")

        assert response.status_code == 409
        assert response.data["detail"] == "Already being unmerged"
