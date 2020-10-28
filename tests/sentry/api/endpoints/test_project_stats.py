from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry import tsdb
from sentry.testutils import APITestCase


class ProjectStatsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project1 = self.create_project(name="foo")
        project2 = self.create_project(name="bar")

        tsdb.incr(tsdb.models.project_total_received, project1.id, count=3)
        tsdb.incr(tsdb.models.project_total_received, project2.id, count=5)

        url = reverse(
            "sentry-api-0-project-stats",
            kwargs={"organization_slug": project1.organization.slug, "project_slug": project1.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 3, response.data
        for point in response.data[:-1]:
            assert point[1] == 0
        assert len(response.data) == 24

    def test_get_error_message_stats(self):
        self.login_as(user=self.user)

        project1 = self.create_project(name="foo")

        STAT_OPTS = {
            "ip-address": 1,
            "release-version": 2,
            "error-message": 3,
            "browser-extensions": 4,
            "legacy-browsers": 5,
            "localhost": 6,
            "web-crawlers": 7,
            "invalid-csp": 8,
        }

        tsdb.incr(
            tsdb.models.project_total_received_ip_address,
            project1.id,
            count=STAT_OPTS["ip-address"],
        )
        tsdb.incr(
            tsdb.models.project_total_received_release_version,
            project1.id,
            count=STAT_OPTS["release-version"],
        )
        tsdb.incr(
            tsdb.models.project_total_received_error_message,
            project1.id,
            count=STAT_OPTS["error-message"],
        )
        tsdb.incr(
            tsdb.models.project_total_received_browser_extensions,
            project1.id,
            count=STAT_OPTS["browser-extensions"],
        )
        tsdb.incr(
            tsdb.models.project_total_received_legacy_browsers,
            project1.id,
            count=STAT_OPTS["legacy-browsers"],
        )
        tsdb.incr(
            tsdb.models.project_total_received_localhost, project1.id, count=STAT_OPTS["localhost"]
        )
        tsdb.incr(
            tsdb.models.project_total_received_web_crawlers,
            project1.id,
            count=STAT_OPTS["web-crawlers"],
        )
        tsdb.incr(
            tsdb.models.project_total_received_invalid_csp,
            project1.id,
            count=STAT_OPTS["invalid-csp"],
        )

        url = reverse(
            "sentry-api-0-project-stats",
            kwargs={"organization_slug": project1.organization.slug, "project_slug": project1.slug},
        )
        for stat in STAT_OPTS.keys():
            response = self.client.get(url, {"stat": stat}, format="json")
            assert response.status_code == 200, response.content
            assert len(response.data) == 24
            assert response.data[-1][1] == STAT_OPTS[stat], response.data
