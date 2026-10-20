from django.db import connections, router, transaction

from sentry.db.models.manager.base import flush_manager_local_cache
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.helpers.options import override_options
from sentry.utils.cache import cache
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor


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


class PostUpdateCacheInvalidationTest(TransactionTestCase):
    def setUp(self) -> None:
        super().setUp()

        cache.clear()

        flush_manager_local_cache()

    @override_options({"groups.post-update-invalidates-cache": True})
    def test_post_update_signal_invalidates_cached_instance(self) -> None:
        group = self.create_group()

        assert Group.objects.get_from_cache(id=group.id).status == GroupStatus.UNRESOLVED

        Group.objects.filter(id=group.id).with_post_update_signal(True).update(
            status=GroupStatus.RESOLVED
        )

        assert Group.objects.get_from_cache(id=group.id).status == GroupStatus.RESOLVED

    @override_options({"groups.post-update-invalidates-cache": True})
    def test_post_update_signal_invalidates_every_cached_instance_in_bulk_update(self) -> None:
        group_ids = [self.create_group().id for _ in range(3)]

        statuses_before_update = [
            Group.objects.get_from_cache(id=group_id).status for group_id in group_ids
        ]

        assert statuses_before_update == [GroupStatus.UNRESOLVED] * 3

        Group.objects.filter(id__in=group_ids).with_post_update_signal(True).update(
            status=GroupStatus.RESOLVED
        )

        statuses_after_update = [
            Group.objects.get_from_cache(id=group_id).status for group_id in group_ids
        ]

        assert statuses_after_update == [GroupStatus.RESOLVED] * 3

    @override_options({"groups.post-update-invalidates-cache": False})
    def test_post_update_signal_keeps_cached_instance_when_option_disabled(self) -> None:
        group = self.create_group()

        assert Group.objects.get_from_cache(id=group.id).status == GroupStatus.UNRESOLVED

        Group.objects.filter(id=group.id).with_post_update_signal(True).update(
            status=GroupStatus.RESOLVED
        )

        assert Group.objects.get_from_cache(id=group.id).status == GroupStatus.UNRESOLVED

    @override_options({"groups.post-update-invalidates-cache": True})
    def test_post_update_signal_invalidates_instance_cached_by_another_connection_before_commit(
        self,
    ) -> None:
        group = self.create_group()

        def get_status_from_another_connection() -> int:
            try:
                return Group.objects.get_from_cache(id=group.id).status
            finally:
                connections.close_all()

        with ContextPropagatingThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic(router.db_for_write(Group)):
                Group.objects.filter(id=group.id).with_post_update_signal(True).update(
                    status=GroupStatus.RESOLVED
                )

                status_before_commit = executor.submit(get_status_from_another_connection).result(
                    timeout=10
                )

        assert status_before_commit == GroupStatus.UNRESOLVED

        assert Group.objects.get_from_cache(id=group.id).status == GroupStatus.RESOLVED
