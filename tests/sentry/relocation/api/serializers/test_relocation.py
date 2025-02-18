from datetime import datetime, timezone

from sentry.api.serializers import serialize
from sentry.models.importchunk import ControlImportChunkReplica, RegionImportChunk
from sentry.relocation.models.relocation import Relocation
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils.relocation import OrderedTask

TEST_DATE_ADDED = datetime(2023, 1, 23, 1, 23, 45, tzinfo=timezone.utc)
TEST_DATE_UPDATED = datetime(2023, 1, 23, 1, 24, 45, tzinfo=timezone.utc)


@freeze_time(TEST_DATE_UPDATED)
class RelocationSerializerTest(TestCase):
    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="owner", is_superuser=False, is_staff=True, is_active=True
        )
        self.superuser = self.create_user(
            "superuser", is_superuser=True, is_staff=True, is_active=True
        )
        self.login_as(user=self.superuser, superuser=True)

        self.first_imported_user = self.create_user(email="first@example.com")
        self.second_imported_user = self.create_user(email="second@example.com")
        self.imported_org = self.create_organization(owner=self.first_imported_user)
        self.create_member(
            user=self.second_imported_user, organization=self.imported_org, role="member", teams=[]
        )

    def mock_imported_users_and_org(self, relocation: Relocation) -> None:
        ControlImportChunkReplica.objects.create(
            import_uuid=relocation.uuid,
            model="sentry.user",
            min_ordinal=1,
            max_ordinal=2,
            min_source_pk=1,
            max_source_pk=2,
            min_inserted_pk=1,
            max_inserted_pk=2,
            inserted_map={1: self.first_imported_user.id, 2: self.second_imported_user.id},
        )
        RegionImportChunk.objects.create(
            import_uuid=relocation.uuid,
            model="sentry.organization",
            min_ordinal=1,
            max_ordinal=2,
            min_source_pk=1,
            max_source_pk=2,
            min_inserted_pk=1,
            max_inserted_pk=2,
            inserted_map={1: self.imported_org.id},
        )

    def test_in_progress(self):
        relocation: Relocation = Relocation.objects.create(
            date_added=TEST_DATE_ADDED,
            creator_id=self.superuser.id,
            owner_id=self.owner.id,
            status=Relocation.Status.IN_PROGRESS.value,
            step=Relocation.Step.UPLOADING.value,
            scheduled_pause_at_step=Relocation.Step.POSTPROCESSING.value,
            want_org_slugs=["foo"],
            want_usernames=["alice", "bob"],
            latest_notified=None,
            latest_task=OrderedTask.UPLOADING_COMPLETE.name,
            latest_task_attempts=1,
        )
        result = serialize(relocation)

        assert result["dateAdded"] == TEST_DATE_ADDED
        assert result["dateUpdated"] == TEST_DATE_UPDATED
        assert result["uuid"] == str(relocation.uuid)
        assert result["creator"]["id"] == str(self.superuser.id)
        assert result["creator"]["email"] == str(self.superuser.email)
        assert result["creator"]["username"] == str(self.superuser.username)
        assert result["owner"]["id"] == str(self.owner.id)
        assert result["owner"]["email"] == str(self.owner.email)
        assert result["owner"]["username"] == str(self.owner.username)
        assert result["status"] == Relocation.Status.IN_PROGRESS.name
        assert result["step"] == Relocation.Step.UPLOADING.name
        assert not result["failureReason"]
        assert result["scheduledPauseAtStep"] == Relocation.Step.POSTPROCESSING.name
        assert not result["scheduledCancelAtStep"]
        assert result["wantOrgSlugs"] == ["foo"]
        assert result["wantUsernames"] == ["alice", "bob"]
        assert not result["latestNotified"]
        assert not result["latestUnclaimedEmailsSentAt"]
        assert result["latestTask"] == OrderedTask.UPLOADING_COMPLETE.name
        assert result["latestTaskAttempts"] == 1
        assert result["importedUserIds"] == []
        assert result["importedOrgIds"] == []

    def test_pause(self):
        relocation: Relocation = Relocation.objects.create(
            date_added=TEST_DATE_ADDED,
            creator_id=self.superuser.id,
            owner_id=self.owner.id,
            status=Relocation.Status.PAUSE.value,
            step=Relocation.Step.IMPORTING.value,
            want_org_slugs=["bar"],
            want_usernames=["charlie", "denise"],
            latest_notified=Relocation.EmailKind.STARTED.value,
            latest_task=OrderedTask.IMPORTING.name,
            latest_task_attempts=1,
        )
        self.mock_imported_users_and_org(relocation)
        result = serialize(relocation)

        assert result["dateAdded"] == TEST_DATE_ADDED
        assert result["dateUpdated"] == TEST_DATE_UPDATED
        assert result["uuid"] == str(relocation.uuid)
        assert result["creator"]["id"] == str(self.superuser.id)
        assert result["creator"]["email"] == str(self.superuser.email)
        assert result["creator"]["username"] == str(self.superuser.username)
        assert result["owner"]["id"] == str(self.owner.id)
        assert result["owner"]["email"] == str(self.owner.email)
        assert result["owner"]["username"] == str(self.owner.username)
        assert result["status"] == Relocation.Status.PAUSE.name
        assert result["step"] == Relocation.Step.IMPORTING.name
        assert not result["failureReason"]
        assert not result["scheduledPauseAtStep"]
        assert not result["scheduledCancelAtStep"]
        assert result["wantOrgSlugs"] == ["bar"]
        assert result["wantUsernames"] == ["charlie", "denise"]
        assert result["latestNotified"] == Relocation.EmailKind.STARTED.name
        assert not result["latestUnclaimedEmailsSentAt"]
        assert result["latestTask"] == OrderedTask.IMPORTING.name
        assert result["latestTaskAttempts"] == 1
        assert sorted(result["importedUserIds"]) == [
            self.first_imported_user.id,
            self.second_imported_user.id,
        ]
        assert result["importedOrgIds"] == [self.imported_org.id]

    def test_success(self):
        relocation: Relocation = Relocation.objects.create(
            date_added=TEST_DATE_ADDED,
            creator_id=self.superuser.id,
            owner_id=self.owner.id,
            status=Relocation.Status.SUCCESS.value,
            step=Relocation.Step.COMPLETED.value,
            want_org_slugs=["foo"],
            want_usernames=["emily", "fred"],
            latest_notified=Relocation.EmailKind.SUCCEEDED.value,
            latest_unclaimed_emails_sent_at=TEST_DATE_UPDATED,
            latest_task=OrderedTask.COMPLETED.name,
            latest_task_attempts=1,
        )
        self.mock_imported_users_and_org(relocation)
        result = serialize(relocation)

        assert result["dateAdded"] == TEST_DATE_ADDED
        assert result["dateUpdated"] == TEST_DATE_UPDATED
        assert result["uuid"] == str(relocation.uuid)
        assert result["creator"]["id"] == str(self.superuser.id)
        assert result["creator"]["email"] == str(self.superuser.email)
        assert result["creator"]["username"] == str(self.superuser.username)
        assert result["owner"]["id"] == str(self.owner.id)
        assert result["owner"]["email"] == str(self.owner.email)
        assert result["owner"]["username"] == str(self.owner.username)
        assert result["status"] == Relocation.Status.SUCCESS.name
        assert result["step"] == Relocation.Step.COMPLETED.name
        assert not result["failureReason"]
        assert not result["scheduledPauseAtStep"]
        assert not result["scheduledCancelAtStep"]
        assert result["wantOrgSlugs"] == ["foo"]
        assert result["wantUsernames"] == ["emily", "fred"]
        assert result["latestNotified"] == Relocation.EmailKind.SUCCEEDED.name
        assert result["latestUnclaimedEmailsSentAt"] == TEST_DATE_UPDATED
        assert result["latestTask"] == OrderedTask.COMPLETED.name
        assert result["latestTaskAttempts"] == 1
        assert sorted(result["importedUserIds"]) == [
            self.first_imported_user.id,
            self.second_imported_user.id,
        ]
        assert result["importedOrgIds"] == [self.imported_org.id]

    def test_failure(self):
        relocation: Relocation = Relocation.objects.create(
            date_added=TEST_DATE_ADDED,
            creator_id=self.superuser.id,
            owner_id=self.owner.id,
            status=Relocation.Status.FAILURE.value,
            step=Relocation.Step.VALIDATING.value,
            scheduled_cancel_at_step=Relocation.Step.IMPORTING.value,
            failure_reason="Some failure reason",
            want_org_slugs=["qux"],
            want_usernames=["alice", "bob"],
            latest_notified=Relocation.EmailKind.FAILED.value,
            latest_task=OrderedTask.VALIDATING_COMPLETE.name,
            latest_task_attempts=1,
        )
        result = serialize(relocation)

        assert result["dateAdded"] == TEST_DATE_ADDED
        assert result["dateUpdated"] == TEST_DATE_UPDATED
        assert result["uuid"] == str(relocation.uuid)
        assert result["creator"]["id"] == str(self.superuser.id)
        assert result["creator"]["email"] == str(self.superuser.email)
        assert result["creator"]["username"] == str(self.superuser.username)
        assert result["owner"]["id"] == str(self.owner.id)
        assert result["owner"]["email"] == str(self.owner.email)
        assert result["owner"]["username"] == str(self.owner.username)
        assert result["status"] == Relocation.Status.FAILURE.name
        assert result["step"] == Relocation.Step.VALIDATING.name
        assert result["failureReason"] == "Some failure reason"
        assert not result["scheduledPauseAtStep"]
        assert result["scheduledCancelAtStep"] == Relocation.Step.IMPORTING.name
        assert result["wantOrgSlugs"] == ["qux"]
        assert result["wantUsernames"] == ["alice", "bob"]
        assert result["latestNotified"] == Relocation.EmailKind.FAILED.name
        assert not result["latestUnclaimedEmailsSentAt"]
        assert result["latestTask"] == OrderedTask.VALIDATING_COMPLETE.name
        assert result["latestTaskAttempts"] == 1
        assert result["importedUserIds"] == []
        assert result["importedOrgIds"] == []
