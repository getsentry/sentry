from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.uptime.detectors.ranking import (
    _get_cluster,
    add_base_url_to_rank,
    get_project_bucket_key,
    get_project_hostname_rank_key,
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
        key = get_project_hostname_rank_key(project)
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
