from sentry.models.featureadoption import FeatureAdoptionRedisBackend
from sentry.testutils.cases import TestCase
from sentry.utils.redis import redis_clusters


class TestFeatureAdoptionRedisCache(TestCase):
    def setUp(self) -> None:
        self.cache = FeatureAdoptionRedisBackend(cluster="default")
        self.org_id = 1234

    def test_in_cache(self) -> None:
        assert not self.cache.in_cache(self.org_id, 90)
        self.cache.bulk_set_cache(self.org_id, 90)
        assert self.cache.in_cache(self.org_id, 90)

    def test_get_all_cache(self) -> None:
        fids = {70, 71, 72, 90, 91, 92}
        self.cache.bulk_set_cache(self.org_id, *fids)
        assert self.cache.get_all_cache(self.org_id) == fids

    def test_bulk_set_cache_sets_ttl(self) -> None:
        self.cache.bulk_set_cache(self.org_id, 90)
        org_key = self.cache.key_tpl.format(self.org_id)
        assert self.cache.cluster.ttl(org_key) > 0


class TestFeatureAdoptionRedisClusterCache(TestFeatureAdoptionRedisCache):
    def setUp(self) -> None:
        # Uses the str client that a Redis Cluster config gets. The parent uses the bytes client.
        self.cache = FeatureAdoptionRedisBackend()
        self.cache.cluster = redis_clusters.get("default")
        self.org_id = 1234
