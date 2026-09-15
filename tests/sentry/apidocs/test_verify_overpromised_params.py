"""Runtime evidence for the schema fixes. Exploratory, not committed.

Every request goes through the full Django stack, middleware included, and the
documented values come straight from the constants being changed.
"""

from __future__ import annotations

from typing import Any
from unittest import mock

import pytest
from django.urls import reverse

from sentry import tagstore
from sentry.apidocs.parameters import IssueParams, ReleaseParams
from sentry.models.release import Release
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]


class ReleaseDetailsSortTest(APITestCase):
    def test_status_for_each_documented_sort(self) -> None:
        release = Release.objects.create(organization_id=self.organization.id, version="abcabcabc")
        release.add_project(self.project)
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_id_or_slug": self.organization.slug, "version": release.version},
        )
        documented = ReleaseParams.SORT.enum
        with_project = {
            sort: self.client.get(url, {"project": str(self.project.id), "sort": sort}).status_code
            for sort in documented
        }
        without_project = {
            sort: self.client.get(url, {"sort": sort}).status_code for sort in documented
        }
        print(f"\nRELEASE documented={documented}")  # noqa: S002, T201
        print(f"RELEASE with project:    {with_project}")  # noqa: S002, T201
        print(f"RELEASE without project: {without_project}")  # noqa: S002, T201
        assert with_project == {sort: (200 if sort == "date" else 400) for sort in documented}


class TagValuesSortTest(APITestCase, SnubaTestCase):
    def test_order_the_endpoint_uses_for_each_documented_sort(self) -> None:
        event = self.store_event(
            data={"tags": {"foo": "bar"}, "timestamp": before_now(seconds=1).isoformat()},
            project_id=self.project.id,
        )
        assert event.group is not None
        self.login_as(user=self.user)
        url = f"/api/0/organizations/{self.organization.slug}/issues/{event.group.id}/tags/foo/values/"
        real = tagstore.backend.get_group_tag_value_paginator

        documented = IssueParams.SORT.enum
        sent = [None, *documented, *(f"-{sort}" for sort in documented)]
        order_by: dict[str | None, Any] = {}
        for sort in sent:
            with mock.patch.object(
                tagstore.backend, "get_group_tag_value_paginator", wraps=real
            ) as paginator:
                response = self.client.get(url, {"sort": sort} if sort else {})
            assert response.status_code == 200, (sort, response.content)
            assert paginator.call_count == 1, sort
            order_by[sort] = paginator.call_args.kwargs.get("order_by", paginator.call_args)
        print(f"\nTAG VALUES documented={documented}")  # noqa: S002, T201
        for sort, order in order_by.items():
            print(f"TAG VALUES sort={sort!r:10} -> order_by={order!r}")  # noqa: S002, T201
        for sort in documented:
            assert order_by[f"-{sort}"] == order_by[None], sort


def _collapse_values() -> list[str]:
    return list(IssueParams.GROUP_INDEX_COLLAPSE.enum)


class ShortIdCollapseTest(APITestCase):
    def test_every_documented_collapse_leaves_the_response_unchanged(self) -> None:
        group = self.create_group(project=self.project, short_id=self.project.next_short_id())
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-short-id-lookup",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "issue_id": group.qualified_short_id,
            },
        )
        baseline = self.client.get(url)
        assert baseline.status_code == 200
        values = _collapse_values()
        print(f"\nSHORTID documented collapse={values}")  # noqa: S002, T201
        for query in [
            *(f"collapse={v}" for v in values),
            "&".join(f"collapse={v}" for v in values),
        ]:
            response = self.client.get(f"{url}?{query}")
            assert response.status_code == 200, query
            assert response.data == baseline.data, query


class ProjectIssuesCollapseTest(APITestCase, SnubaTestCase):
    def test_every_documented_collapse_leaves_the_response_unchanged(self) -> None:
        self.store_event(
            data={"fingerprint": ["group-1"], "timestamp": before_now(minutes=1).isoformat()},
            project_id=self.project.id,
        )
        self.login_as(user=self.user)
        path = (
            f"/api/0/projects/{self.organization.slug}/{self.project.slug}/issues/?statsPeriod=24h"
        )
        baseline = self.client.get(path)
        assert baseline.status_code == 200
        assert len(baseline.data) == 1
        values = _collapse_values()
        print(f"\nPROJECT ISSUES documented collapse={values}; keys={sorted(baseline.data[0])}")  # noqa: S002, T201
        for query in [
            *(f"collapse={v}" for v in values),
            "&".join(f"collapse={v}" for v in values),
        ]:
            response = self.client.get(f"{path}&{query}")
            assert response.status_code == 200, query
            assert response.data == baseline.data, query


class OrganizationIssuesCollapseControlTest(APITestCase, SnubaTestCase):
    def test_collapse_is_detectable_where_an_endpoint_reads_it(self) -> None:
        """Proves the comparison above would catch a collapse that is actually read."""
        self.store_event(
            data={"fingerprint": ["group-1"], "timestamp": before_now(minutes=1).isoformat()},
            project_id=self.project.id,
        )
        self.login_as(user=self.user)
        path = f"/api/0/organizations/{self.organization.slug}/issues/?statsPeriod=24h"
        baseline = self.client.get(path)
        collapsed = self.client.get(f"{path}&collapse=stats")
        assert baseline.status_code == collapsed.status_code == 200
        print(f"\nORG ISSUES keys={sorted(baseline.data[0])} collapsed={sorted(collapsed.data[0])}")  # noqa: S002, T201
        assert "stats" in baseline.data[0]
        assert "stats" not in collapsed.data[0]
