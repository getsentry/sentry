from sentry.models.projectsdk import EventType, ProjectSDK
from sentry.testutils.cases import TestCase
from sentry.utils.cache import cache


class UpdateWithNewestVersionOrCreateTest(TestCase):
    event_type = EventType.PROFILE_CHUNK

    def test_first_sdk_version(self):
        project_sdk = ProjectSDK.update_with_newest_version_or_create(
            project=self.project,
            event_type=self.event_type,
            sdk_name="sentry.python",
            sdk_version="2.23.0",
        )

        assert project_sdk.project == self.project
        assert project_sdk.event_type == self.event_type.value
        assert project_sdk.sdk_name == "sentry.python"
        assert project_sdk.sdk_version == "2.23.0"

    def test_newer_sdk_version(self):
        old = ProjectSDK.objects.create(
            project=self.project,
            event_type=self.event_type.value,
            sdk_name="sentry.python",
            sdk_version="2.21.0",
        )

        new = ProjectSDK.update_with_newest_version_or_create(
            project=self.project,
            event_type=self.event_type,
            sdk_name="sentry.python",
            sdk_version="2.23.0",
        )

        assert old.id == new.id

        assert new.project == self.project
        assert new.event_type == self.event_type.value
        assert new.sdk_name == "sentry.python"
        assert new.sdk_version == "2.23.0"

    def test_older_sdk_version(self):
        old = ProjectSDK.objects.create(
            project=self.project,
            event_type=self.event_type.value,
            sdk_name="sentry.python",
            sdk_version="2.23.0",
        )

        new = ProjectSDK.update_with_newest_version_or_create(
            project=self.project,
            event_type=self.event_type,
            sdk_name="sentry.python",
            sdk_version="2.21.0",
        )

        assert old.id == new.id

        assert new.project == self.project
        assert new.event_type == self.event_type.value
        assert new.sdk_name == "sentry.python"
        assert new.sdk_version == "2.23.0"

    def test_same_sdk_version(self):
        old = ProjectSDK.objects.create(
            project=self.project,
            event_type=self.event_type.value,
            sdk_name="sentry.python",
            sdk_version="2.23.0",
        )

        new = ProjectSDK.update_with_newest_version_or_create(
            project=self.project,
            event_type=self.event_type,
            sdk_name="sentry.python",
            sdk_version="2.23.0",
        )

        assert old.id == new.id

        assert new.project == self.project
        assert new.event_type == self.event_type.value
        assert new.sdk_name == "sentry.python"
        assert new.sdk_version == "2.23.0"

    def test_cached_sdk_version(self):
        project_sdk = ProjectSDK.update_with_newest_version_or_create(
            project=self.project,
            event_type=self.event_type,
            sdk_name="sentry.python",
            sdk_version="2.23.0",
        )

        assert project_sdk.project == self.project
        assert project_sdk.event_type == self.event_type.value
        assert project_sdk.sdk_name == "sentry.python"
        assert project_sdk.sdk_version == "2.23.0"

        cache_key = ProjectSDK.get_cache_key(self.project, self.event_type, "sentry.python")
        cached = cache.get(cache_key)

        assert cached.id == project_sdk.id
        assert cached.project == project_sdk.project
        assert cached.event_type == project_sdk.event_type
        assert cached.sdk_name == project_sdk.sdk_name
        assert cached.sdk_version == project_sdk.sdk_version
