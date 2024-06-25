from datetime import datetime
from unittest import mock

from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.uptime.detectors.ranking import (
    NUMBER_OF_BUCKETS,
    _get_cluster,
    add_base_url_to_rank,
    delete_candidate_urls_for_project,
    delete_project_bucket,
    get_candidate_urls_for_project,
    get_project_base_url_rank_key,
    get_project_bucket,
    get_project_bucket_key,
)


class AddBaseUrlToRankTest(TestCase):
    def assert_project_count(
        self, project: Project, count: int | None, expiry: int | None
    ) -> int | None:
        key = get_project_bucket_key(project)
        cluster = _get_cluster()
        if count is None:
            assert not cluster.hexists(key, str(project.id))
            return None
        else:
            assert int(str(cluster.hget(key, str(project.id)))) == count
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
        with mock.patch("sentry.uptime.detectors.ranking.RANKED_TRIM_CHANCE", new=1), mock.patch(
            "sentry.uptime.detectors.ranking.RANKED_MAX_SIZE", new=2
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


class GetCandidateUrlsForProjectTest(TestCase):
    def test(self):
        assert get_candidate_urls_for_project(self.project) == []
        url_1 = "https://sentry.io"
        url_2 = "https://sentry.sentry.io"
        add_base_url_to_rank(self.project, url_1)
        assert get_candidate_urls_for_project(self.project) == [(url_1, 1)]
        add_base_url_to_rank(self.project, url_2)
        add_base_url_to_rank(self.project, url_2)
        assert get_candidate_urls_for_project(self.project) == [(url_2, 2), (url_1, 1)]


class DeleteCandidateUrlsForProjectTest(TestCase):
    def test(self):
        delete_candidate_urls_for_project(self.project)
        url_1 = "https://sentry.io"
        add_base_url_to_rank(self.project, url_1)
        assert get_candidate_urls_for_project(self.project) == [(url_1, 1)]
        delete_candidate_urls_for_project(self.project)
        assert get_candidate_urls_for_project(self.project) == []


class GetProjectBucketTest(TestCase):
    def test(self):
        bucket = datetime.now().replace(second=0, microsecond=0)
        assert get_project_bucket(bucket) == {}
        dummy_project_id = int(bucket.timestamp() % NUMBER_OF_BUCKETS)
        self.project.id = dummy_project_id
        add_base_url_to_rank(self.project, "https://sentry.io")
        assert get_project_bucket(bucket) == {self.project.id: 1}


class DeleteProjectBucketTest(TestCase):
    def test(self):
        bucket = datetime.now().replace(second=0, microsecond=0)
        delete_project_bucket(bucket)
        dummy_project_id = int(bucket.timestamp() % NUMBER_OF_BUCKETS)
        self.project.id = dummy_project_id
        add_base_url_to_rank(self.project, "https://sentry.io")
        assert get_project_bucket(bucket) == {self.project.id: 1}
        delete_project_bucket(bucket)
        assert get_project_bucket(bucket) == {}
