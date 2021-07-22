import uuid
from datetime import datetime, timezone

import pytest
from dateutil.parser import parse as parse_date

from sentry.lang.native import appconnect
from sentry.tasks.app_store_connect import update_build_refresh_date
from sentry.utils import json


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
            itunesPersonId="123",
            itunesSession="THE-COOKIE",
            itunesCreated=datetime.utcnow(),
            appName="My App",
            appId="123",
            bundleId="com.example.app",
            orgId=123,
            orgName="Example Com",
        )

    @pytest.mark.django_db
    def test_update_build_refresh_date(self, default_project, config):
        starting_option = default_project.get_option(
            appconnect.APPSTORECONNECT_BUILD_REFRESHES_OPTION, default="{}"
        )
        assert starting_option == "{}"

        update_build_refresh_date(default_project, config.id)

        serialized = default_project.get_option(
            appconnect.APPSTORECONNECT_BUILD_REFRESHES_OPTION, default="{}"
        )
        updated_option = json.loads(serialized)

        # An explicit entry was created
        assert len(updated_option) == 1
        assert config.id in updated_option
        # The entry has some sort of value
        assert updated_option[config.id] is not None

        new_date = parse_date(updated_option[config.id])
        assert isinstance(new_date, datetime)

    @pytest.mark.django_db
    def test_update_existing_build_refresh_date(self, default_project, config):
        old_build_refresh_date = datetime(2020, 2, 20, tzinfo=timezone.utc)

        starting_option = default_project.update_option(
            appconnect.APPSTORECONNECT_BUILD_REFRESHES_OPTION,
            json.dumps({config.id: old_build_refresh_date}),
        )
        assert starting_option != "{}"

        update_build_refresh_date(default_project, config.id)

        serialized = default_project.get_option(
            appconnect.APPSTORECONNECT_BUILD_REFRESHES_OPTION, default="{}"
        )
        updated_option = json.loads(serialized)

        assert len(updated_option) == 1
        assert updated_option[config.id] is not None

        new_date = parse_date(updated_option[config.id])
        assert isinstance(new_date, datetime)
        assert new_date > old_build_refresh_date

    @pytest.mark.django_db
    def test_update_build_refresh_date_has_other_builds(self, default_project, config):
        other_build_id = uuid.uuid4().hex
        other_build_refresh_date = datetime(2020, 2, 20, tzinfo=timezone.utc)

        starting_option = default_project.update_option(
            appconnect.APPSTORECONNECT_BUILD_REFRESHES_OPTION,
            json.dumps({other_build_id: other_build_refresh_date}),
        )
        assert starting_option != "{}"

        update_build_refresh_date(default_project, config.id)

        serialized = default_project.get_option(
            appconnect.APPSTORECONNECT_BUILD_REFRESHES_OPTION, default="{}"
        )
        updated_option = json.loads(serialized)

        # Existing entries are preserved
        assert len(updated_option) == 2
        assert parse_date(updated_option[other_build_id]) == other_build_refresh_date

        # An explicit new entry was created
        assert config.id in updated_option
        # The entry has some sort of value
        assert updated_option[config.id] is not None

        new_date = parse_date(updated_option[config.id])
        assert isinstance(new_date, datetime)
