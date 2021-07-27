import uuid
from datetime import datetime

import pytest

from sentry.lang.native import appconnect
from sentry.models.appconnectbuilds import AppConnectBuild
from sentry.tasks.app_store_connect import get_or_create_persisted_build


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
            itunesUser="me@example.com",
            itunesPassword="secret",
            itunesSession="THE-COOKIE",
            itunesCreated=datetime.utcnow(),
            appName="My App",
            appId="123",
            bundleId="com.example.app",
            orgPublicId="71105f98-7743-4844-ab70-2c901e2ea13d",
            orgName="Example Com",
        )

    @pytest.fixture
    def build(self):
        return appconnect.BuildInfo(
            app_id="123",
            platform="iOS",
            version="3.1.5",
            build_number="20200220",
            uploaded_date=datetime.utcnow(),
        )

    @pytest.mark.django_db
    def create_new_persisted_build(self, default_project, config, build):
        returned_build = get_or_create_persisted_build(default_project, config, build)

        expected_build = AppConnectBuild(
            project=default_project,
            app_id=build.app_id,
            bundle_id=config.bundleId,
            platform=build.platform,
            bundle_short_version=build.version,
            bundle_version=build.build_number,
            uploaded_to_appstore=build.uploaded_date,
            first_seen=datetime.now(),
            fetched=False,
        )

        assert returned_build.fetched == expected_build.fetched
        assert returned_build.project == expected_build.project
        assert returned_build.app_id == expected_build.app_id
        assert returned_build.bundle_id == expected_build.bundleId
        assert returned_build.platform == expected_build.platform
        assert returned_build.bundle_short_version == expected_build.version
        assert returned_build.bundle_version == expected_build.build_number
        assert returned_build.uploaded_to_appstore == expected_build.uploaded_date

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
        assert saved_build.bundle_id == expected_build.bundleId
        assert saved_build.platform == expected_build.platform
        assert saved_build.bundle_short_version == expected_build.version
        assert saved_build.bundle_version == expected_build.build_number
        assert saved_build.uploaded_to_appstore == expected_build.uploaded_date

    @pytest.mark.django_db
    def get_persisted_build(self, default_project, config, build):
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

    @pytest.mark.django_db
    def get_persisted_build_preserves_existing_fetched(self, default_project, config, build):
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
