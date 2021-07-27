import uuid
from datetime import datetime

import pytest
from django.utils import timezone

from sentry.lang.native import appconnect
from sentry.models import LatestAppConnectBuildsCheck


class TestCreateOrUpdateBuildCheck:
    @pytest.fixture
    def config(self):
        return appconnect.AppStoreConnectConfig(
            type="appStoreConnect",
            id=uuid.uuid4().hex,
            name="Apple Honk Store Connect",
            appconnectIssuer="abc123" * 6,
            appconnectKey="abc123key",
            appconnectPrivateKey="----BEGIN PRIVATE KEY---- honkhonk",
            itunesUser="me@example.com",
            itunesPassword="secrethonk",
            itunesSession="THE-COOKIE",
            itunesCreated=datetime.utcnow(),
            appName="honk beep",
            appId="123",
            bundleId="com.honk.app",
            orgPublicId="71105f98-7743-4844-ab70-2c901e2ea13d",
            orgName="Honk Com",
        )

    @pytest.mark.django_db
    def test_add_new_check_date(self, default_project, config):
        with pytest.raises(LatestAppConnectBuildsCheck.DoesNotExist):
            LatestAppConnectBuildsCheck.objects.get(project=default_project, source_id=config.id)

        now = timezone.now()
        LatestAppConnectBuildsCheck.objects.create_or_update(
            project=default_project, source_id=config.id, values={"last_checked": now}
        )

        assert LatestAppConnectBuildsCheck.objects.count() == 1

        try:
            check_entry = LatestAppConnectBuildsCheck.objects.get(
                project=default_project, source_id=config.id
            )

        except LatestAppConnectBuildsCheck.DoesNotExist:
            raise AssertionError("Build check entry disappeared after update")

        assert check_entry.last_checked == now

    @pytest.mark.django_db
    def test_update_existing_check_date(self, default_project, config):
        old_build_check_date = datetime(2020, 2, 20, tzinfo=timezone.utc)

        LatestAppConnectBuildsCheck.objects.create(
            project=default_project,
            source_id=config.id,
            last_checked=old_build_check_date,
        )

        try:
            LatestAppConnectBuildsCheck.objects.get(project=default_project, source_id=config.id)
        except LatestAppConnectBuildsCheck.DoesNotExist:
            raise AssertionError("Unable to pre-populate database with an existing check entry")

        now = timezone.now()
        LatestAppConnectBuildsCheck.objects.create_or_update(
            project=default_project, source_id=config.id, values={"last_checked": now}
        )

        try:
            updated_check_entry = LatestAppConnectBuildsCheck.objects.get(
                project=default_project, source_id=config.id
            )
        except LatestAppConnectBuildsCheck.DoesNotExist:
            raise AssertionError("Build check entry disappeared after update")

        assert updated_check_entry.last_checked == now

    @pytest.mark.django_db
    def test_add_new_check_date_with_other_builds(self, default_project, config):
        other_build_id = uuid.uuid4().hex
        other_build_refresh_date = datetime(2020, 2, 20, tzinfo=timezone.utc)

        LatestAppConnectBuildsCheck.objects.create(
            project=default_project, source_id=other_build_id, last_checked=other_build_refresh_date
        )

        assert LatestAppConnectBuildsCheck.objects.count() == 1

        now = timezone.now()
        LatestAppConnectBuildsCheck.objects.create_or_update(
            project=default_project, source_id=config.id, values={"last_checked": now}
        )

        assert LatestAppConnectBuildsCheck.objects.count() == 2

        try:
            updated_check_entry = LatestAppConnectBuildsCheck.objects.get(
                project=default_project, source_id=config.id
            )
        except LatestAppConnectBuildsCheck.DoesNotExist:
            raise AssertionError("Build check entry disappeared after update")

        assert updated_check_entry.last_checked == now

        try:
            other_build_check = LatestAppConnectBuildsCheck.objects.get(
                project=default_project, source_id=other_build_id
            )
        except LatestAppConnectBuildsCheck.DoesNotExist:
            raise AssertionError("Other build check entry disappeared after update")

        assert other_build_check.last_checked == other_build_refresh_date

    @pytest.mark.django_db
    def test_update_existing_check_date_with_other_builds(self, default_project, config):
        other_build_id = uuid.uuid4().hex
        other_build_refresh_date = datetime(2020, 2, 20, tzinfo=timezone.utc)

        LatestAppConnectBuildsCheck.objects.create(
            project=default_project, source_id=other_build_id, last_checked=other_build_refresh_date
        )
        LatestAppConnectBuildsCheck.objects.create(
            project=default_project, source_id=config.id, last_checked=other_build_refresh_date
        )

        assert LatestAppConnectBuildsCheck.objects.count() == 2

        now = timezone.now()
        LatestAppConnectBuildsCheck.objects.create_or_update(
            project=default_project, source_id=config.id, values={"last_checked": now}
        )

        assert LatestAppConnectBuildsCheck.objects.count() == 2

        try:
            updated_check_entry = LatestAppConnectBuildsCheck.objects.get(
                project=default_project, source_id=config.id
            )
        except LatestAppConnectBuildsCheck.DoesNotExist:
            raise AssertionError("Build check entry disappeared after update")

        assert updated_check_entry.last_checked == now

        try:
            other_build_check = LatestAppConnectBuildsCheck.objects.get(
                project=default_project, source_id=other_build_id
            )
        except LatestAppConnectBuildsCheck.DoesNotExist:
            raise AssertionError("Other build check entry disappeared after update")

        assert other_build_check.last_checked == other_build_refresh_date
