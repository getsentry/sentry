from datetime import datetime
from unittest import mock

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.testutils.cases import UptimeTestCase
from sentry.uptime.detectors.ranking import (
    _get_cluster,
    add_base_url_to_rank,
    build_org_projects_key,
    delete_candidate_urls_for_project,
    delete_organization_bucket,
    get_candidate_projects_for_org,
    get_candidate_urls_for_project,
    get_organization_bucket,
    get_project_base_url_rank_key,
    should_detect_for_organization,
    should_detect_for_project,
)


class AddBaseUrlToRankTest(UptimeTestCase):
    def assert_project_count(
        self, project: Project, count: int | None, expiry: int | None
    ) -> int | None:
        key = build_org_projects_key(project.organization)
        cluster = _get_cluster()
        if count is None:
            assert not cluster.zscore(key, str(project.id))
            return None
        else:
            assert int(float(str(cluster.zscore(key, str(project.id))))) == count
            return self.check_expiry(key, expiry)

    def assert_url_count(
        self, project: Project, url: str, count: int | None, expiry: int | None
    ) -> int | None:
        key = get_project_base_url_rank_key(project)
        cluster = _get_cluster()
        if count is None:
            assert cluster.zscore(key, url) is None
            return None
        else:
            assert cluster.zscore(key, url) == count
            return self.check_expiry(key, expiry)

    def check_expiry(self, key: str, expiry: int | None) -> int:
        cluster = _get_cluster()
        ttl = cluster.ttl(key)
        if expiry is None:
            assert ttl > 0
        else:
            assert ttl == expiry
        return ttl

    def test(self):
        project_2 = self.create_project()
        url_1 = "https://sentry.io"
        url_2 = "https://sentry.sentry.io"
        add_base_url_to_rank(self.project, url_1)
        project_1_expiry = self.assert_project_count(self.project, 1, None)
        self.assert_project_count(project_2, None, -2)
        project_1_url_expiry = self.assert_url_count(self.project, url_1, 1, None)
        self.assert_url_count(project_2, url_1, None, -2)

        add_base_url_to_rank(self.project, url_1)
        self.assert_project_count(self.project, 2, project_1_expiry)
        self.assert_project_count(project_2, None, -2)
        self.assert_url_count(self.project, url_1, 2, project_1_url_expiry)
        self.assert_url_count(project_2, url_1, None, -2)

        add_base_url_to_rank(self.project, url_2)
        self.assert_project_count(self.project, 3, project_1_expiry)
        self.assert_project_count(project_2, None, -2)
        self.assert_url_count(self.project, url_1, 2, project_1_url_expiry)
        self.assert_url_count(self.project, url_2, 1, project_1_url_expiry)
        self.assert_url_count(project_2, url_1, None, -2)
        self.assert_url_count(project_2, url_2, None, -2)

        add_base_url_to_rank(project_2, url_2)
        self.assert_project_count(self.project, 3, project_1_expiry)
        self.assert_project_count(project_2, 1, None)
        self.assert_url_count(self.project, url_1, 2, project_1_url_expiry)
        self.assert_url_count(self.project, url_2, 1, project_1_url_expiry)
        project_2_url_expiry = self.assert_url_count(project_2, url_1, None, None)
        self.assert_url_count(project_2, url_2, 1, project_2_url_expiry)

    def test_trim(self):
        with (
            mock.patch("sentry.uptime.detectors.ranking.RANKED_TRIM_CHANCE", new=1),
            mock.patch("sentry.uptime.detectors.ranking.RANKED_MAX_SIZE", new=2),
        ):
            key = get_project_base_url_rank_key(self.project)
            url_1 = "https://sentry.io"
            url_2 = "https://sentry.sentry.io"
            url_3 = "https://santry.sentry.io"
            cluster = _get_cluster()
            add_base_url_to_rank(self.project, url_1)
            add_base_url_to_rank(self.project, url_1)
            add_base_url_to_rank(self.project, url_1)
            assert cluster.zrange(key, 0, -1) == [url_1]
            add_base_url_to_rank(self.project, url_2)
            add_base_url_to_rank(self.project, url_2)
            assert cluster.zrange(key, 0, -1) == [url_2, url_1]
            # Since we're trimming immediately, this url will be immediately dropped since it's seen one time
            add_base_url_to_rank(self.project, url_3)
            assert cluster.zrange(key, 0, -1) == [url_2, url_1]


class GetCandidateProjectsForOrgTest(UptimeTestCase):
    def test(self):
        assert get_candidate_projects_for_org(self.organization) == []
        url_1 = "https://sentry.io"
        url_2 = "https://sentry.sentry.io"
        add_base_url_to_rank(self.project, url_1)
        assert get_candidate_projects_for_org(self.organization) == [(self.project.id, 1)]
        add_base_url_to_rank(self.project, url_2)
        project_2 = self.create_project()
        add_base_url_to_rank(project_2, url_2)
        assert get_candidate_projects_for_org(self.organization) == [
            (self.project.id, 2),
            (project_2.id, 1),
        ]


class GetCandidateUrlsForProjectTest(UptimeTestCase):
    def test(self):
        assert get_candidate_urls_for_project(self.project) == []
        url_1 = "https://sentry.io"
        url_2 = "https://sentry.sentry.io"
        add_base_url_to_rank(self.project, url_1)
        assert get_candidate_urls_for_project(self.project) == [(url_1, 1)]
        add_base_url_to_rank(self.project, url_2)
        add_base_url_to_rank(self.project, url_2)
        assert get_candidate_urls_for_project(self.project) == [(url_2, 2), (url_1, 1)]

    def test_limits(self):
        with mock.patch("sentry.uptime.subscriptions.subscriptions.MAX_MONITORS_PER_DOMAIN", 1):
            other_proj = self.create_project()
            url_1 = "https://sentry.io"
            self.create_project_uptime_subscription(
                project=other_proj, uptime_subscription=self.create_uptime_subscription(url=url_1)
            )
            url_2 = "https://sentry.sentry.io"
            url_3 = "https://sentry.santry.io"
            add_base_url_to_rank(self.project, url_1)
            add_base_url_to_rank(self.project, url_2)
            add_base_url_to_rank(self.project, url_3)
            assert get_candidate_urls_for_project(self.project) == [(url_3, 1)]


class DeleteCandidateUrlsForProjectTest(UptimeTestCase):
    def test(self):
        delete_candidate_urls_for_project(self.project)
        url_1 = "https://sentry.io"
        add_base_url_to_rank(self.project, url_1)
        assert get_candidate_urls_for_project(self.project) == [(url_1, 1)]
        delete_candidate_urls_for_project(self.project)
        assert get_candidate_urls_for_project(self.project) == []


class GetOrganizationBucketTest(UptimeTestCase):
    def test(self):
        bucket = datetime(2024, 7, 18, 0, 47)
        assert get_organization_bucket(bucket) == set()
        dummy_org_id = 47
        self.project.organization = Organization(id=dummy_org_id)
        self.project.organization_id = dummy_org_id
        add_base_url_to_rank(self.project, "https://sentry.io")
        assert get_organization_bucket(bucket) == {self.project.organization_id}


class DeleteOrganizationBucketTest(UptimeTestCase):
    def test(self):
        bucket = datetime(2024, 7, 18, 0, 47)
        delete_organization_bucket(bucket)
        dummy_org_id = 1487
        self.project.organization = Organization(id=dummy_org_id)
        self.project.organization_id = dummy_org_id
        add_base_url_to_rank(self.project, "https://sentry.io")
        assert get_organization_bucket(bucket) == {self.project.organization_id}
        delete_organization_bucket(bucket)
        assert get_organization_bucket(bucket) == set()


class ShouldDetectForProjectTest(UptimeTestCase):
    def test(self):
        assert should_detect_for_project(self.project)
        self.project.update_option("sentry:uptime_autodetection", False)
        assert not should_detect_for_project(self.project)
        self.project.update_option("sentry:uptime_autodetection", True)
        assert should_detect_for_project(self.project)


class ShouldDetectForOrgTest(UptimeTestCase):
    def test(self):
        assert should_detect_for_organization(self.organization)
        self.organization.update_option("sentry:uptime_autodetection", False)
        assert not should_detect_for_organization(self.organization)
        self.organization.update_option("sentry:uptime_autodetection", True)
        assert should_detect_for_organization(self.organization)

    def test_quota(self):
        assert should_detect_for_organization(self.organization)
        uptime_monitor = self.create_project_uptime_subscription()
        assert not should_detect_for_organization(self.organization)
        uptime_monitor.delete()
        assert should_detect_for_organization(self.organization)
