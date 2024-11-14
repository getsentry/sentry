from sentry.models.featureadoption import FeatureAdoptionRedisBackend
from sentry.testutils.cases import TestCase
from sentry.utils.redis import redis_clusters


class TestFeatureAdoptionRedisCache(TestCase):
    def setUp(self):
        self.cache = FeatureAdoptionRedisBackend(cluster="default")
        self.org_id = 1234

    def test_in_cache(self):
        assert not self.cache.in_cache(self.org_id, 90)
        self.cache.bulk_set_cache(self.org_id, 90)
        assert self.cache.in_cache(self.org_id, 90)

    def test_get_all_cache(self):
        fids = {70, 71, 72, 90, 91, 92}
        self.cache.bulk_set_cache(self.org_id, *fids)
        assert self.cache.get_all_cache(self.org_id) == fids


class TestFeatureAdoptionRedisClusterCache(TestFeatureAdoptionRedisCache):
    def setUp(self):
        # TODO: Once we have properly redis-cluster setup in tests and CI use that For now  that's
        # the simplest way to test non redis-blaster compatibility.
        self.cache = FeatureAdoptionRedisBackend()
        self.cache.is_redis_cluster, self.cache.cluster = True, redis_clusters.get("default")
        self.org_id = 1234
