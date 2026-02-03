from unittest.mock import MagicMock, patch

from django.core.cache import cache

from sentry import options
from sentry.grouping.ingest.caching import (
    get_grouphash_cache_version,
    get_grouphash_existence_cache_key,
    get_grouphash_object_cache_key,
    invalidate_grouphash_cache_on_save,
    invalidate_grouphash_caches_on_delete,
)
from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.mocking import count_matching_calls
from sentry.types.grouphash_metadata import (
    FingerprintHashingMetadata,
    SaltedStacktraceHashingMetadata,
    StacktraceHashingMetadata,
)
from sentry.utils import json


class GetAssociatedFingerprintTest(TestCase):
    def test_simple(self) -> None:
        raw_fingerprint = ["maisey", "charlie", "{{ message }}"]
        resolved_fingerprint = ["maisey", "charlie", "Dogs are great!"]

        hashing_metadata: FingerprintHashingMetadata = {
            "fingerprint": json.dumps(resolved_fingerprint),
            "fingerprint_source": "client",
            "is_hybrid_fingerprint": False,
            "client_fingerprint": json.dumps(raw_fingerprint),
        }

        grouphash = GroupHash.objects.create(hash="yay_dogs", project_id=self.project.id)
        GroupHashMetadata.objects.create(grouphash=grouphash, hashing_metadata=hashing_metadata)

        assert grouphash.get_associated_fingerprint() == resolved_fingerprint

    def test_hybrid_fingerprint(self) -> None:
        """
        Test that it works for events grouped on things other than fingerprint.
        """
        raw_fingerprint = ["{{ default }}", "maisey", "charlie", "{{ message }}"]
        resolved_fingerprint = ["{{ default }}", "maisey", "charlie", "Dogs are great!"]

        hashing_metadata: SaltedStacktraceHashingMetadata = {
            "stacktrace_type": "in-app",
            "stacktrace_location": "exception",
            "num_stacktraces": 1,
            "fingerprint": json.dumps(resolved_fingerprint),
            "fingerprint_source": "client",
            "is_hybrid_fingerprint": True,
            "client_fingerprint": json.dumps(raw_fingerprint),
        }

        grouphash = GroupHash.objects.create(hash="yay_dogs", project_id=self.project.id)
        GroupHashMetadata.objects.create(grouphash=grouphash, hashing_metadata=hashing_metadata)

        assert grouphash.get_associated_fingerprint() == resolved_fingerprint

    def test_stringified_fingerprint(self) -> None:
        """
        Test handling of fingerprint metadata from back when we were stringifying rather than
        jsonifying the fingerprint value.
        """
        raw_fingerprint = ["maisey", "charlie", "{{ message }}"]
        resolved_fingerprint = ["maisey", "charlie", "Dogs are great!"]

        hashing_metadata: FingerprintHashingMetadata = {
            "fingerprint": str(resolved_fingerprint),
            "fingerprint_source": "client",
            "is_hybrid_fingerprint": False,
            "client_fingerprint": str(raw_fingerprint),
        }

        grouphash = GroupHash.objects.create(hash="yay_dogs", project_id=self.project.id)
        GroupHashMetadata.objects.create(grouphash=grouphash, hashing_metadata=hashing_metadata)

        assert grouphash.get_associated_fingerprint() is None

    def test_no_metadata(self) -> None:
        grouphash = GroupHash.objects.create(hash="yay_dogs", project_id=self.project.id)

        assert grouphash.metadata is None
        assert grouphash.get_associated_fingerprint() is None

    def test_no_hashing_metadata(self) -> None:
        grouphash = GroupHash.objects.create(hash="yay_dogs", project_id=self.project.id)
        GroupHashMetadata.objects.create(grouphash=grouphash)

        assert grouphash.metadata and grouphash.metadata.hashing_metadata is None
        assert grouphash.get_associated_fingerprint() is None

    def test_no_fingerprint(self) -> None:
        hashing_metadata: StacktraceHashingMetadata = {
            "stacktrace_type": "in-app",
            "stacktrace_location": "exception",
            "num_stacktraces": 1,
        }

        grouphash = GroupHash.objects.create(hash="yay_dogs", project_id=self.project.id)
        GroupHashMetadata.objects.create(grouphash=grouphash, hashing_metadata=hashing_metadata)

        assert grouphash.get_associated_fingerprint() is None


class CacheInvalidationTest(TestCase):
    """
    Test that the caches we use for grouphashes during ingest (one for secondary grouphash existence
    and one for the `GroupHash` objects themselves) are invalidated when their contents might become
    stale.

    For `delete` we test both caches, but for `update` we only need to test the latter cache, since
    it doesn't change whether or not a grouphash exists. We also only need to test the latter cache
    for `save` - not because you can't change existence with a `save` call, but because we only
    track existence of secondary grouphashes, and we never create a secondary grouphash if it
    doesn't already exist.
    """

    def test_removes_from_cache_on_queryset_update(self) -> None:
        project = self.project
        get_cache_key = get_grouphash_object_cache_key
        expiry_option_version = get_grouphash_cache_version("object")
        cache_expiry_seconds = options.get("grouping.ingest_grouphash_existence_cache_expiry")

        maisey_key = get_cache_key(hash_value="maisey", project_id=project.id)
        charlie_key = get_cache_key(hash_value="charlie", project_id=project.id)
        dogs_key = get_cache_key(hash_value="dogs_are_great", project_id=project.id)

        group1 = self.create_group(project)
        group2 = self.create_group(project)

        grouphash1 = GroupHash.objects.create(project=project, group=group1, hash="maisey")
        grouphash2 = GroupHash.objects.create(project=project, group=group1, hash="charlie")
        grouphash3 = GroupHash.objects.create(project=project, group=group1, hash="dogs_are_great")

        cache.set(maisey_key, grouphash1, cache_expiry_seconds, version=expiry_option_version)
        cache.set(charlie_key, grouphash2, cache_expiry_seconds, version=expiry_option_version)
        cache.set(dogs_key, grouphash3, cache_expiry_seconds, version=expiry_option_version)

        # TODO: These (and the checks below) can be simplified to use in/not in once version is gone
        assert cache.has_key(maisey_key, version=expiry_option_version)
        assert cache.has_key(charlie_key, version=expiry_option_version)
        assert cache.has_key(dogs_key, version=expiry_option_version)

        GroupHash.objects.filter(hash__in=["maisey", "charlie"]).update(group=group2)

        # The updated grouphashes have been removed from the cache, but the one we didn't update is
        # still there
        assert not cache.has_key(maisey_key, version=expiry_option_version)
        assert not cache.has_key(charlie_key, version=expiry_option_version)
        assert cache.has_key(dogs_key, version=expiry_option_version)

    def test_removes_from_cache_on_model_update(self) -> None:
        project = self.project
        get_cache_key = get_grouphash_object_cache_key
        expiry_option_version = get_grouphash_cache_version("object")
        cache_expiry_seconds = options.get("grouping.ingest_grouphash_existence_cache_expiry")

        maisey_key = get_cache_key(hash_value="maisey", project_id=project.id)
        charlie_key = get_cache_key(hash_value="charlie", project_id=project.id)
        dogs_key = get_cache_key(hash_value="dogs_are_great", project_id=project.id)

        group1 = self.create_group(project)
        group2 = self.create_group(project)

        grouphash1 = GroupHash.objects.create(project=project, group=group1, hash="maisey")
        grouphash2 = GroupHash.objects.create(project=project, group=group1, hash="charlie")
        grouphash3 = GroupHash.objects.create(project=project, group=group1, hash="dogs_are_great")

        cache.set(maisey_key, grouphash1, cache_expiry_seconds, version=expiry_option_version)
        cache.set(charlie_key, grouphash2, cache_expiry_seconds, version=expiry_option_version)
        cache.set(dogs_key, grouphash3, cache_expiry_seconds, version=expiry_option_version)

        # TODO: These (and the checks below) can be simplified to use in/not in once version is gone
        assert cache.has_key(maisey_key, version=expiry_option_version)
        assert cache.has_key(charlie_key, version=expiry_option_version)
        assert cache.has_key(dogs_key, version=expiry_option_version)

        grouphash1.update(group=group2)
        grouphash2.update(group=group2)

        # The updated grouphashes have been removed from the cache, but the one we didn't update is
        # still there
        assert not cache.has_key(maisey_key, version=expiry_option_version)
        assert not cache.has_key(charlie_key, version=expiry_option_version)
        assert cache.has_key(dogs_key, version=expiry_option_version)

    def test_removes_from_cache_on_model_save(self) -> None:
        project = self.project
        get_cache_key = get_grouphash_object_cache_key
        expiry_option_version = get_grouphash_cache_version("object")
        cache_expiry_seconds = options.get("grouping.ingest_grouphash_existence_cache_expiry")

        maisey_key = get_cache_key(hash_value="maisey", project_id=project.id)
        charlie_key = get_cache_key(hash_value="charlie", project_id=project.id)
        dogs_key = get_cache_key(hash_value="dogs_are_great", project_id=project.id)

        group1 = self.create_group(project)
        group2 = self.create_group(project)

        grouphash1 = GroupHash.objects.create(project=project, group=group1, hash="maisey")
        grouphash2 = GroupHash.objects.create(project=project, group=group1, hash="charlie")
        grouphash3 = GroupHash.objects.create(project=project, group=group1, hash="dogs_are_great")

        cache.set(maisey_key, grouphash1, cache_expiry_seconds, version=expiry_option_version)
        cache.set(charlie_key, grouphash2, cache_expiry_seconds, version=expiry_option_version)
        cache.set(dogs_key, grouphash3, cache_expiry_seconds, version=expiry_option_version)

        # TODO: These (and the checks below) can be simplified to use in/not in once version is gone
        assert cache.has_key(maisey_key, version=expiry_option_version)
        assert cache.has_key(charlie_key, version=expiry_option_version)
        assert cache.has_key(dogs_key, version=expiry_option_version)

        grouphash1.group = group2
        grouphash1.save()
        grouphash2.group = group2
        grouphash2.save()

        # The grouphashes on which we called `save` have been removed from the cache, but the one we
        # didn't update is still there
        assert not cache.has_key(maisey_key, version=expiry_option_version)
        assert not cache.has_key(charlie_key, version=expiry_option_version)
        assert cache.has_key(dogs_key, version=expiry_option_version)

    def test_removes_from_cache_on_queryset_delete(self) -> None:
        project = self.project
        get_object_cache_key = get_grouphash_object_cache_key
        get_existence_cache_key = get_grouphash_existence_cache_key
        object_expiry_option_version = get_grouphash_cache_version("object")
        existence_expiry_option_version = get_grouphash_cache_version("existence")
        cache_expiry_seconds = options.get("grouping.ingest_grouphash_existence_cache_expiry")

        maisey_object_key = get_object_cache_key(hash_value="maisey", project_id=project.id)
        charlie_object_key = get_object_cache_key(hash_value="charlie", project_id=project.id)
        dogs_object_key = get_object_cache_key(hash_value="dogs_are_great", project_id=project.id)
        maisey_existence_key = get_existence_cache_key(hash_value="maisey", project_id=project.id)
        charlie_existence_key = get_existence_cache_key(hash_value="charlie", project_id=project.id)
        dogs_existence_key = get_existence_cache_key(
            hash_value="dogs_are_great", project_id=project.id
        )

        group = self.create_group(project)

        grouphash1 = GroupHash.objects.create(project=project, group=group, hash="maisey")
        grouphash2 = GroupHash.objects.create(project=project, group=group, hash="charlie")
        grouphash3 = GroupHash.objects.create(project=project, group=group, hash="dogs_are_great")

        cache.set(
            maisey_object_key,
            grouphash1,
            cache_expiry_seconds,
            version=object_expiry_option_version,
        )
        cache.set(
            charlie_object_key,
            grouphash2,
            cache_expiry_seconds,
            version=object_expiry_option_version,
        )
        cache.set(
            dogs_object_key, grouphash3, cache_expiry_seconds, version=object_expiry_option_version
        )
        cache.set(
            maisey_existence_key,
            True,
            cache_expiry_seconds,
            version=existence_expiry_option_version,
        )
        cache.set(
            charlie_existence_key,
            True,
            cache_expiry_seconds,
            version=existence_expiry_option_version,
        )
        cache.set(
            dogs_existence_key, True, cache_expiry_seconds, version=existence_expiry_option_version
        )

        # TODO: These (and the checks below) can be simplified to use in/not in once version is gone
        assert cache.has_key(maisey_object_key, version=object_expiry_option_version)
        assert cache.has_key(charlie_object_key, version=object_expiry_option_version)
        assert cache.has_key(dogs_object_key, version=object_expiry_option_version)
        assert cache.has_key(maisey_existence_key, version=existence_expiry_option_version)
        assert cache.has_key(charlie_existence_key, version=existence_expiry_option_version)
        assert cache.has_key(dogs_existence_key, version=existence_expiry_option_version)

        GroupHash.objects.filter(hash__in=["maisey", "charlie"]).delete()

        # The deleted grouphashes have been removed from the cache, but the one we didn't delete is
        # still there
        assert not cache.has_key(maisey_object_key, version=object_expiry_option_version)
        assert not cache.has_key(charlie_object_key, version=object_expiry_option_version)
        assert cache.has_key(dogs_object_key, version=object_expiry_option_version)
        assert not cache.has_key(maisey_existence_key, version=existence_expiry_option_version)
        assert not cache.has_key(charlie_existence_key, version=existence_expiry_option_version)
        assert cache.has_key(dogs_existence_key, version=existence_expiry_option_version)

    def test_removes_from_cache_on_model_delete(self) -> None:
        project = self.project
        get_object_cache_key = get_grouphash_object_cache_key
        get_existence_cache_key = get_grouphash_existence_cache_key
        object_expiry_option_version = get_grouphash_cache_version("object")
        existence_expiry_option_version = get_grouphash_cache_version("existence")
        cache_expiry_seconds = options.get("grouping.ingest_grouphash_existence_cache_expiry")

        maisey_object_key = get_object_cache_key(hash_value="maisey", project_id=project.id)
        charlie_object_key = get_object_cache_key(hash_value="charlie", project_id=project.id)
        dogs_object_key = get_object_cache_key(hash_value="dogs_are_great", project_id=project.id)
        maisey_existence_key = get_existence_cache_key(hash_value="maisey", project_id=project.id)
        charlie_existence_key = get_existence_cache_key(hash_value="charlie", project_id=project.id)
        dogs_existence_key = get_existence_cache_key(
            hash_value="dogs_are_great", project_id=project.id
        )

        group = self.create_group(project)

        grouphash1 = GroupHash.objects.create(project=project, group=group, hash="maisey")
        grouphash2 = GroupHash.objects.create(project=project, group=group, hash="charlie")
        grouphash3 = GroupHash.objects.create(project=project, group=group, hash="dogs_are_great")

        cache.set(
            maisey_object_key,
            grouphash1,
            cache_expiry_seconds,
            version=object_expiry_option_version,
        )
        cache.set(
            charlie_object_key,
            grouphash2,
            cache_expiry_seconds,
            version=object_expiry_option_version,
        )
        cache.set(
            dogs_object_key, grouphash3, cache_expiry_seconds, version=object_expiry_option_version
        )
        cache.set(
            maisey_existence_key,
            True,
            cache_expiry_seconds,
            version=existence_expiry_option_version,
        )
        cache.set(
            charlie_existence_key,
            True,
            cache_expiry_seconds,
            version=existence_expiry_option_version,
        )
        cache.set(
            dogs_existence_key, True, cache_expiry_seconds, version=existence_expiry_option_version
        )

        # TODO: These (and the checks below) can be simplified to use in/not in once version is gone
        assert cache.has_key(maisey_object_key, version=object_expiry_option_version)
        assert cache.has_key(charlie_object_key, version=object_expiry_option_version)
        assert cache.has_key(dogs_object_key, version=object_expiry_option_version)
        assert cache.has_key(maisey_existence_key, version=existence_expiry_option_version)
        assert cache.has_key(charlie_existence_key, version=existence_expiry_option_version)
        assert cache.has_key(dogs_existence_key, version=existence_expiry_option_version)

        grouphash1.delete()
        grouphash2.delete()

        # The deleted grouphashes have been removed from the cache, but the one we didn't delete is
        # still there
        assert not cache.has_key(maisey_object_key, version=object_expiry_option_version)
        assert not cache.has_key(charlie_object_key, version=object_expiry_option_version)
        assert cache.has_key(dogs_object_key, version=object_expiry_option_version)
        assert not cache.has_key(maisey_existence_key, version=existence_expiry_option_version)
        assert not cache.has_key(charlie_existence_key, version=existence_expiry_option_version)
        assert cache.has_key(dogs_existence_key, version=existence_expiry_option_version)

    @patch("sentry.grouping.ingest.caching.cache.delete")
    def test_no_ops_on_grouphash_creation(self, cache_delete_mock: MagicMock) -> None:
        project = self.project
        get_cache_key = get_grouphash_object_cache_key
        expiry_option_version = get_grouphash_cache_version("object")
        maisey_key = get_cache_key(hash_value="maisey", project_id=project.id)

        group1 = self.create_group(project)
        group2 = self.create_group(project)

        grouphash = GroupHash.objects.create(project=project, group=group1, hash="maisey")

        # We listen to the `pre_save` signal, which gets triggered by both `create` and `save`
        # calls, but there's only something to invalidate in the latter case, so we bail early
        # during grouphash creation.
        assert (
            count_matching_calls(cache_delete_mock, maisey_key, version=expiry_option_version) == 0
        )

        grouphash.group = group2
        grouphash.save()

        assert (
            count_matching_calls(cache_delete_mock, maisey_key, version=expiry_option_version) == 1
        )

    @patch("sentry.grouping.ingest.caching.cache.delete")
    @patch("sentry.grouping.ingest.caching.cache.delete_many")
    def test_no_ops_when_caching_is_disabled(
        self, cache_delete_many_mock: MagicMock, cache_delete_mock: MagicMock
    ) -> None:
        project = self.project
        get_object_cache_key = get_grouphash_object_cache_key
        get_existence_cache_key = get_grouphash_existence_cache_key

        object_expiry_option_version = get_grouphash_cache_version("object")
        existence_expiry_option_version = get_grouphash_cache_version("existence")
        object_key = get_object_cache_key(hash_value="maisey", project_id=project.id)
        existence_key = get_existence_cache_key(hash_value="maisey", project_id=project.id)

        group = self.create_group(project)

        grouphash = GroupHash.objects.create(project=project, group=group, hash="maisey")

        with override_options({"grouping.use_ingest_grouphash_caching": False}):
            invalidate_grouphash_cache_on_save(grouphash)
            invalidate_grouphash_caches_on_delete(grouphash)

            # TODO: These two can go back to being
            #    assert count_matching_calls(cache_delete_mock, object_key) == 0
            #    assert count_matching_calls(cache_delete_many_mock, [object_key, existence_key]) == 0
            # once version is gone
            assert (
                count_matching_calls(
                    cache_delete_mock, object_key, version=object_expiry_option_version
                )
                == 0
            )
            assert (
                count_matching_calls(
                    cache_delete_mock, existence_key, version=existence_expiry_option_version
                )
                == 0
            )

        with override_options({"grouping.use_ingest_grouphash_caching": True}):
            invalidate_grouphash_cache_on_save(grouphash)
            invalidate_grouphash_caches_on_delete(grouphash)

            # TODO: These two can go back to being
            #    assert count_matching_calls(cache_delete_mock, object_key) == 1
            #    assert count_matching_calls(cache_delete_many_mock, [object_key, existence_key]) == 1
            # once version is gone
            assert (
                count_matching_calls(
                    cache_delete_mock, object_key, version=object_expiry_option_version
                )
                == 2
            )
            assert (
                count_matching_calls(
                    cache_delete_mock, existence_key, version=existence_expiry_option_version
                )
                == 1
            )
