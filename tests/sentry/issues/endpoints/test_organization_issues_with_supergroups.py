from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import orjson

from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now


def mock_seer_response(data: dict[str, Any], status: int = 200) -> MagicMock:
    response = MagicMock()
    response.status = status
    response.data = orjson.dumps(data) if status == 200 else b""
    return response


class OrganizationIssuesWithSupergroupsEndpointTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-issues-with-supergroups"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def _store(self, fingerprint: str, seconds_ago: int = 10) -> Any:
        return self.store_event(
            data={
                "fingerprint": [fingerprint],
                "timestamp": before_now(seconds=seconds_ago).isoformat(),
            },
            project_id=self.project.id,
        )

    def test_feature_flag_off_returns_403(self) -> None:
        self.get_error_response(self.organization.slug, status_code=403)

    @patch("sentry.seer.supergroups.by_group.make_supergroups_get_by_group_ids_request")
    def test_collapses_cluster_members_into_representative(self, mock_seer: MagicMock) -> None:
        a = self._store("a")
        b = self._store("b")
        c = self._store("c")
        mock_seer.return_value = mock_seer_response(
            {
                "data": [
                    {
                        "id": 99,
                        "group_ids": [a.group_id, b.group_id],
                        "title": "cluster",
                    }
                ]
            }
        )

        with self.feature("organizations:top-issues-ui"):
            response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 2
        rep = next(r for r in response.data if "supergroup" in r)
        assert rep["supergroup"]["id"] == 99
        assert {g["id"] for g in rep["matchingGroups"]} == {str(a.group_id), str(b.group_id)}
        standalone = next(r for r in response.data if "supergroup" not in r)
        assert standalone["id"] == str(c.group_id)

    @patch("sentry.seer.supergroups.by_group.make_supergroups_get_by_group_ids_request")
    def test_demotes_cluster_with_single_visible_member(self, mock_seer: MagicMock) -> None:
        visible = self._store("visible")
        mock_seer.return_value = mock_seer_response(
            {
                "data": [
                    {
                        "id": 99,
                        "group_ids": [visible.group_id, 99999],
                        "title": "cluster",
                    }
                ]
            }
        )

        with self.feature("organizations:top-issues-ui"):
            response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 1
        assert response.data[0]["id"] == str(visible.group_id)
        assert "supergroup" not in response.data[0]

    @patch("sentry.seer.supergroups.by_group.make_supergroups_get_by_group_ids_request")
    def test_falls_back_to_plain_groups_when_seer_fails(self, mock_seer: MagicMock) -> None:
        event = self._store("fallback")
        mock_seer.return_value = mock_seer_response({}, status=503)

        with self.feature("organizations:top-issues-ui"):
            response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 1
        assert response.data[0]["id"] == str(event.group_id)
        assert "supergroup" not in response.data[0]

    @patch("sentry.seer.supergroups.by_group.make_supergroups_get_by_group_ids_request")
    def test_paginates_without_group_overlap(self, mock_seer: MagicMock) -> None:
        events = [self._store(f"e{i}") for i in range(4)]
        mock_seer.return_value = mock_seer_response({"data": []})

        with self.feature("organizations:top-issues-ui"):
            page1 = self.get_success_response(self.organization.slug, qs_params={"limit": "2"})
        assert len(page1.data) == 2

        links = parse_link_header(page1["Link"])
        next_href = next(url for url, attrs in links.items() if attrs["rel"] == "next")

        with self.feature("organizations:top-issues-ui"):
            page2 = self.client.get(next_href, format="json")
        assert page2.status_code == 200
        assert len(page2.data) == 2

        page1_ids = {r["id"] for r in page1.data}
        page2_ids = {r["id"] for r in page2.data}
        assert page1_ids.isdisjoint(page2_ids)
        assert page1_ids | page2_ids == {str(e.group_id) for e in events}

    @patch("sentry.seer.supergroups.by_group.make_supergroups_get_by_group_ids_request")
    def test_paginates_with_collapse_no_group_skip(self, mock_seer: MagicMock) -> None:
        # Staggered timestamps pin sort order so events[0] is first.
        events = [self._store(f"e{i}", seconds_ago=10 + i) for i in range(5)]
        # Cluster (e0, e1). Page 1 overfetches [e0..e3] and blends to
        # [rep(e0,e1), e2] — 3 raw groups consumed for 2 rows — so the
        # next cursor must land between e2 and e3.
        mock_seer.return_value = mock_seer_response(
            {
                "data": [
                    {
                        "id": 99,
                        "group_ids": [events[0].group_id, events[1].group_id],
                        "title": "cluster",
                    }
                ]
            }
        )

        with self.feature("organizations:top-issues-ui"):
            page1 = self.get_success_response(self.organization.slug, qs_params={"limit": "2"})

        assert len(page1.data) == 2
        rep = next(r for r in page1.data if "supergroup" in r)
        assert {g["id"] for g in rep["matchingGroups"]} == {
            str(events[0].group_id),
            str(events[1].group_id),
        }
        standalone = next(r for r in page1.data if "supergroup" not in r)
        assert standalone["id"] == str(events[2].group_id)

        links = parse_link_header(page1["Link"])
        next_href = next(url for url, attrs in links.items() if attrs["rel"] == "next")

        with self.feature("organizations:top-issues-ui"):
            page2 = self.client.get(next_href, format="json")
        assert page2.status_code == 200
        # Without the refetch, page 2 would start past e3 and skip it.
        assert {r["id"] for r in page2.data} == {
            str(events[3].group_id),
            str(events[4].group_id),
        }

    @patch("sentry.seer.supergroups.by_group.make_supergroups_get_by_group_ids_request")
    def test_reports_hits_as_row_count(self, mock_seer: MagicMock) -> None:
        self._store("solo")
        mock_seer.return_value = mock_seer_response({"data": []})

        with self.feature("organizations:top-issues-ui"):
            response = self.get_success_response(self.organization.slug)

        assert response["X-Hits"] == "1"
