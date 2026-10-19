from sentry.db.models.manager.base import flush_manager_local_cache
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization
from sentry.testutils.cases import TestCase
from sentry.utils.cache import cache


class GetFromCacheTest(TestCase):
    def setUp(self) -> None:
        self.clear()

    def clear(self) -> None:
        cache.clear()
        flush_manager_local_cache()

    def test_get_cacheable_kv_from_kwargs(self) -> None:
        org = self.create_organization()
        assert Organization.objects._get_cacheable_kv_from_kwargs(dict(id=14)) == ("id", "id", 14)
        assert Organization.objects._get_cacheable_kv_from_kwargs(dict(house=org)) == (
            "house",
            "id",
            org.id,
        )

    def test_cache_pk(self) -> None:
        org = self.create_organization()

        self.clear()
        assert Organization.objects.get_from_cache(slug=org.slug) == org
        assert Organization.objects.get_from_cache(pk=org.id) == org
        assert Organization.objects.get_from_cache(id=org.id) == org

        cache.clear()
        assert Organization.objects.get_from_cache(slug=org.slug) == org
        assert Organization.objects.get_from_cache(pk=org.id) == org
        assert Organization.objects.get_from_cache(id=org.id) == org

        flush_manager_local_cache()
        assert Organization.objects.get_from_cache(slug=org.slug) == org
        assert Organization.objects.get_from_cache(pk=org.id) == org
        assert Organization.objects.get_from_cache(id=org.id) == org

        # Once to hit fully cached path.
        assert Organization.objects.get_from_cache(slug=org.slug) == org
        assert Organization.objects.get_from_cache(pk=org.id) == org
        assert Organization.objects.get_from_cache(id=org.id) == org

    def test_post_update_signal_invalidates_cached_instance(self) -> None:
        group = self.create_group()

        assert Group.objects.get_from_cache(id=group.id).status == GroupStatus.UNRESOLVED

        Group.objects.filter(id=group.id).with_post_update_signal(True).update(
            status=GroupStatus.RESOLVED
        )

        assert Group.objects.get_from_cache(id=group.id).status == GroupStatus.RESOLVED
