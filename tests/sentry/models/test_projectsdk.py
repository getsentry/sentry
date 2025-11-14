from typing import int, Any

from django.test import override_settings

from sentry.models.projectsdk import EventType, ProjectSDK
from sentry.tasks.release_registry import SDK_INDEX_CACHE_KEY
from sentry.testutils.cases import TestCase
from sentry.utils.cache import cache


@override_settings(SENTRY_RELEASE_REGISTRY_BASEURL="foo.bar")
class UpdateWithNewestVersionOrCreateTest(TestCase):
    event_type = EventType.PROFILE_CHUNK

    def setUp(self) -> None:
        # setup some mock data inside the sdk index cache
        SDK_DATA: dict[str, dict[str, Any]] = {
            "sentry.python": {},
        }
        cache.set(SDK_INDEX_CACHE_KEY, SDK_DATA, 60)

    def assert_db_entry(
        self,
        project,
        event_type,
        sdk_name,
        sdk_version,
    ):
        project_sdk = ProjectSDK.objects.get(
            project=project,
            event_type=event_type.value,
            sdk_name=sdk_name,
        )
        assert project_sdk.sdk_version == sdk_version
        return project_sdk

    def assert_cache_entry(
        self,
        project,
        event_type,
        sdk_name,
        sdk_version,
    ):
        cache_key = ProjectSDK.get_cache_key(project, event_type, sdk_name)
        project_sdk = cache.get(cache_key)

        assert project_sdk.project == project
        assert project_sdk.event_type == event_type.value
        assert project_sdk.sdk_name == sdk_name
        assert project_sdk.sdk_version == sdk_version
        return project_sdk

    def test_first_sdk_version(self) -> None:
        ProjectSDK.update_with_newest_version_or_create(
            project=self.project,
            event_type=self.event_type,
            sdk_name="sentry.python",
            sdk_version="2.23.0",
        )

        # check the db entry was created
        db_project_sdk = self.assert_db_entry(
            self.project,
            self.event_type,
            "sentry.python",
            "2.23.0",
        )

        # check the cache entry was created
        cache_project_sdk = self.assert_cache_entry(
            self.project,
            self.event_type,
            "sentry.python",
            "2.23.0",
        )

        assert db_project_sdk.id == cache_project_sdk.id

    def test_newer_sdk_version(self) -> None:
        project_sdk = ProjectSDK.objects.create(
            project=self.project,
            event_type=self.event_type.value,
            sdk_name="sentry.python",
            sdk_version="2.21.0",
        )

        ProjectSDK.update_with_newest_version_or_create(
            project=self.project,
            event_type=self.event_type,
            sdk_name="sentry.python",
            sdk_version="2.23.0",
        )

        # check the db entry was updated
        db_project_sdk = self.assert_db_entry(
            self.project,
            self.event_type,
            "sentry.python",
            "2.23.0",
        )
        assert project_sdk.id == db_project_sdk.id

        # check the cache entry was created
        cache_project_sdk = self.assert_cache_entry(
            self.project,
            self.event_type,
            "sentry.python",
            "2.23.0",
        )
        assert project_sdk.id == cache_project_sdk.id

    def test_older_sdk_version(self) -> None:
        project_sdk = ProjectSDK.objects.create(
            project=self.project,
            event_type=self.event_type.value,
            sdk_name="sentry.python",
            sdk_version="2.23.0",
        )

        ProjectSDK.update_with_newest_version_or_create(
            project=self.project,
            event_type=self.event_type,
            sdk_name="sentry.python",
            sdk_version="2.21.0",
        )

        # check the db entry was unchanged
        db_project_sdk = self.assert_db_entry(
            self.project,
            self.event_type,
            "sentry.python",
            "2.23.0",
        )
        assert project_sdk.id == db_project_sdk.id

        # check the cache entry was created
        cache_project_sdk = self.assert_cache_entry(
            self.project,
            self.event_type,
            "sentry.python",
            "2.23.0",
        )
        assert project_sdk.id == cache_project_sdk.id

    def test_same_sdk_version(self) -> None:
        project_sdk = ProjectSDK.objects.create(
            project=self.project,
            event_type=self.event_type.value,
            sdk_name="sentry.python",
            sdk_version="2.23.0",
        )

        ProjectSDK.update_with_newest_version_or_create(
            project=self.project,
            event_type=self.event_type,
            sdk_name="sentry.python",
            sdk_version="2.23.0",
        )

        # check the db entry was unchanged
        db_project_sdk = self.assert_db_entry(
            self.project,
            self.event_type,
            "sentry.python",
            "2.23.0",
        )
        assert project_sdk.id == db_project_sdk.id

        # check the cache entry was created
        cache_project_sdk = self.assert_cache_entry(
            self.project,
            self.event_type,
            "sentry.python",
            "2.23.0",
        )
        assert project_sdk.id == cache_project_sdk.id

    def test_no_existing_version(self) -> None:
        project_sdk = ProjectSDK.objects.create(
            project=self.project,
            event_type=self.event_type.value,
            sdk_name="sentry.python",
        )

        ProjectSDK.update_with_newest_version_or_create(
            project=self.project,
            event_type=self.event_type,
            sdk_name="sentry.python",
            sdk_version="2.23.0",
        )

        # check the db entry was updated
        db_project_sdk = self.assert_db_entry(
            self.project,
            self.event_type,
            "sentry.python",
            "2.23.0",
        )
        assert project_sdk.id == db_project_sdk.id

        # check the cache entry was created
        cache_project_sdk = self.assert_cache_entry(
            self.project,
            self.event_type,
            "sentry.python",
            "2.23.0",
        )
        assert project_sdk.id == cache_project_sdk.id

    def test_no_new_version(self) -> None:
        project_sdk = ProjectSDK.objects.create(
            project=self.project,
            event_type=self.event_type.value,
            sdk_name="sentry.python",
            sdk_version="2.23.0",
        )

        ProjectSDK.update_with_newest_version_or_create(
            project=self.project,
            event_type=self.event_type,
            sdk_name="sentry.python",
            sdk_version="",
        )

        # check the db entry was unchanged
        db_project_sdk = self.assert_db_entry(
            self.project,
            self.event_type,
            "sentry.python",
            "2.23.0",
        )
        assert project_sdk.id == db_project_sdk.id

        # check the cache entry does not exist
        cache_key = ProjectSDK.get_cache_key(self.project, self.event_type, "sentry.python")
        assert cache.get(cache_key) is None

    def test_updated_cached_sdk_version(self) -> None:
        ProjectSDK.update_with_newest_version_or_create(
            project=self.project,
            event_type=self.event_type,
            sdk_name="sentry.python",
            sdk_version="2.21.0",
        )

        # check the db entry was created
        before_db_project_sdk = self.assert_db_entry(
            self.project,
            self.event_type,
            "sentry.python",
            "2.21.0",
        )

        # check the cache entry was created
        before_cache_project_sdk = self.assert_cache_entry(
            self.project,
            self.event_type,
            "sentry.python",
            "2.21.0",
        )

        assert before_db_project_sdk.id == before_cache_project_sdk.id

        ProjectSDK.update_with_newest_version_or_create(
            project=self.project,
            event_type=self.event_type,
            sdk_name="sentry.python",
            sdk_version="2.23.0",
        )

        # check the db entry was created
        db_project_sdk = self.assert_db_entry(
            self.project,
            self.event_type,
            "sentry.python",
            "2.23.0",
        )
        assert before_db_project_sdk.id == db_project_sdk.id

        # check the cache entry was created
        cache_project_sdk = self.assert_cache_entry(
            self.project,
            self.event_type,
            "sentry.python",
            "2.23.0",
        )
        assert before_cache_project_sdk.id == cache_project_sdk.id

    def test_normalized_sdk_name(self) -> None:
        ProjectSDK.update_with_newest_version_or_create(
            project=self.project,
            event_type=self.event_type,
            sdk_name="sentry.python.django",
            sdk_version="2.23.0",
        )

        # check the db entry was created
        db_project_sdk = self.assert_db_entry(
            self.project,
            self.event_type,
            "sentry.python",
            "2.23.0",
        )

        # check the cache entry was created
        cache_project_sdk = self.assert_cache_entry(
            self.project,
            self.event_type,
            "sentry.python",
            "2.23.0",
        )

        assert db_project_sdk.id == cache_project_sdk.id

    def test_unknown_sdk_name(self) -> None:
        ProjectSDK.update_with_newest_version_or_create(
            project=self.project,
            event_type=self.event_type,
            sdk_name="sentry.unknown",
            sdk_version="2.23.0",
        )

        # check the db entry was created
        assert not ProjectSDK.objects.filter(
            project=self.project,
            event_type=self.event_type.value,
            sdk_name="sentry.unknown",
        ).exists()

        # check the cache entry does not exist
        cache_key = ProjectSDK.get_cache_key(self.project, self.event_type, "sentry.unknown")
        assert cache.get(cache_key) is None
