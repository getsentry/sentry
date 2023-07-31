import uuid
from datetime import datetime

import pytest
from django.utils import timezone

from sentry.lang.native import appconnect
from sentry.models.appconnectbuilds import AppConnectBuild
from sentry.models.latestappconnectbuildscheck import LatestAppConnectBuildsCheck
from sentry.tasks.app_store_connect import get_or_create_persisted_build, process_builds
from sentry.testutils.pytest.fixtures import django_db_all


class TestUpdateDsyms:
    @pytest.fixture
    def config(self):
        return appconnect.AppStoreConnectConfig(
            type="appStoreConnect",
            id=uuid.uuid4().hex,
            name="Apple App Store Connect",
            appconnectIssuer="abc123" * 6,
            appconnectKey="abc123key",
            appconnectPrivateKey="----BEGIN PRIVATE KEY---- blabla",
            appName="My App",
            appId="123",
            bundleId="com.example.app",
        )

    @pytest.fixture
    def build(self):
        return appconnect.BuildInfo(
            app_id="123",
            platform="iOS",
            version="3.1.5",
            build_number="20200220",
            uploaded_date=timezone.now(),
            dsym_url="http://iosapps.itunes.apple.com/itunes-assets/Purple116/v4/20/ba/a0/20baa026-2410-b32f-1fde-b227bc2ea7ae/appDsyms.zip?accessKey=very-cool-key",
        )

    @django_db_all
    def test_process_no_builds(self, default_project, config):
        before = timezone.now()
        pending = process_builds(project=default_project, config=config, to_process=[])
        assert not pending
        entry = LatestAppConnectBuildsCheck.objects.get(
            project=default_project, source_id=config.id
        )
        assert entry.last_checked >= before

    @django_db_all
    def test_process_new_build(self, default_project, config, build):
        before = timezone.now()
        pending = process_builds(project=default_project, config=config, to_process=[build])
        assert len(pending) == 1

        (build, state) = pending[0]
        assert not state.fetched

        entry = LatestAppConnectBuildsCheck.objects.get(
            project=default_project, source_id=config.id
        )
        assert entry.last_checked >= before

    @django_db_all
    def test_process_existing_fetched_build(self, default_project, config, build):
        AppConnectBuild.objects.create(
            project=default_project,
            app_id=build.app_id,
            bundle_id=config.bundleId,
            platform=build.platform,
            bundle_short_version=build.version,
            bundle_version=build.build_number,
            uploaded_to_appstore=build.uploaded_date,
            first_seen=timezone.now(),
            fetched=True,
        )

        before = timezone.now()
        newer_build = appconnect.BuildInfo(
            app_id="123",
            platform="iOS",
            version="3.1.9",
            build_number="20200224",
            uploaded_date=timezone.now(),
            dsym_url="http://iosapps.itunes.apple.com/itunes-assets/Purple116/v4/20/ba/a0/20baa026-2410-b32f-1fde-b227bc2ea7ae/appDsyms.zip?accessKey=very-cool-key",
        )

        pending = process_builds(
            project=default_project, config=config, to_process=[build, newer_build]
        )

        assert len(pending) == 1

        (build, state) = pending[0]
        assert not state.fetched
        assert state.bundle_version == "20200224"

        entry = LatestAppConnectBuildsCheck.objects.get(
            project=default_project, source_id=config.id
        )
        assert entry.last_checked >= before

    @django_db_all
    def test_process_existing_unfetched_build(self, default_project, config, build):
        AppConnectBuild.objects.create(
            project=default_project,
            app_id=build.app_id,
            bundle_id=config.bundleId,
            platform=build.platform,
            bundle_short_version=build.version,
            bundle_version=build.build_number,
            uploaded_to_appstore=build.uploaded_date,
            first_seen=timezone.now(),
            fetched=False,
        )

        before = timezone.now()
        pending = process_builds(project=default_project, config=config, to_process=[build])

        assert len(pending) == 1

        (build, state) = pending[0]
        assert not state.fetched

        entry = LatestAppConnectBuildsCheck.objects.get(
            project=default_project, source_id=config.id
        )
        assert entry.last_checked >= before

    @django_db_all
    def test_create_new_persisted_build(self, default_project, config, build):
        returned_build = get_or_create_persisted_build(default_project, config, build)

        expected_build = AppConnectBuild(
            project=default_project,
            app_id=build.app_id,
            bundle_id=config.bundleId,
            platform=build.platform,
            bundle_short_version=build.version,
            bundle_version=build.build_number,
            uploaded_to_appstore=build.uploaded_date,
            first_seen=timezone.now(),
            fetched=False,
        )

        assert returned_build.fetched == expected_build.fetched
        assert returned_build.project == expected_build.project
        assert returned_build.app_id == expected_build.app_id
        assert returned_build.bundle_id == expected_build.bundle_id
        assert returned_build.platform == expected_build.platform
        assert returned_build.bundle_short_version == expected_build.bundle_short_version
        assert returned_build.bundle_version == expected_build.bundle_version
        assert returned_build.uploaded_to_appstore == expected_build.uploaded_to_appstore

        saved_build = AppConnectBuild.objects.get(
            project=default_project,
            app_id=build.app_id,
            platform=build.platform,
            bundle_short_version=build.version,
            bundle_version=build.build_number,
        )

        assert saved_build.fetched == expected_build.fetched
        assert saved_build.project == expected_build.project
        assert saved_build.app_id == expected_build.app_id
        assert saved_build.bundle_id == expected_build.bundle_id
        assert saved_build.platform == expected_build.platform
        assert saved_build.bundle_short_version == expected_build.bundle_short_version
        assert saved_build.bundle_version == expected_build.bundle_version
        # assert saved_build.uploaded_to_appstore == expected_build.uploaded_to_appstore

    @django_db_all
    def test_get_persisted_build(self, default_project, config, build):
        seen = datetime(2020, 2, 20)

        AppConnectBuild.objects.create(
            project=default_project,
            app_id=build.app_id,
            bundle_id=config.bundleId,
            platform=build.platform,
            bundle_short_version=build.version,
            bundle_version=build.build_number,
            uploaded_to_appstore=build.uploaded_date,
            first_seen=seen,
            fetched=True,
        )

        existing_build = get_or_create_persisted_build(default_project, config, build)

        assert existing_build.fetched
        assert existing_build.project == default_project
        assert existing_build.app_id == build.app_id
        assert existing_build.bundle_id == config.bundleId
        assert existing_build.platform == build.platform
        assert existing_build.bundle_short_version == build.version
        assert existing_build.bundle_version == build.build_number
        assert existing_build.uploaded_to_appstore == build.uploaded_date

    @django_db_all
    def test_get_persisted_build_preserves_existing_fetched(self, default_project, config, build):
        seen = datetime(2020, 2, 20)

        AppConnectBuild.objects.create(
            project=default_project,
            app_id=build.app_id,
            bundle_id=config.bundleId,
            platform=build.platform,
            bundle_short_version=build.version,
            bundle_version=build.build_number,
            uploaded_to_appstore=build.uploaded_date,
            first_seen=seen,
            fetched=False,
        )

        existing_build = get_or_create_persisted_build(default_project, config, build)

        assert not existing_build.fetched
        assert existing_build.project == default_project
        assert existing_build.app_id == build.app_id
        assert existing_build.bundle_id == config.bundleId
        assert existing_build.platform == build.platform
        assert existing_build.bundle_short_version == build.version
        assert existing_build.bundle_version == build.build_number
        assert existing_build.uploaded_to_appstore == build.uploaded_date
