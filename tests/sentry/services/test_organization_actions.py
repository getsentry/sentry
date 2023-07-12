import pytest

from sentry.models import (
    Organization,
    OrganizationStatus,
    OutboxCategory,
    OutboxScope,
    RegionOutbox,
    outbox_context,
)
from sentry.services.hybrid_cloud.organization_actions.impl import (
    create_organization_with_outbox_message,
    mark_organization_as_pending_deletion_with_outbox_message,
    unmark_organization_as_pending_deletion_with_outbox_message,
    update_organization_with_outbox_message,
    upsert_organization_by_org_id_with_outbox_message,
)
from sentry.silo import SiloMode
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test


def assert_outbox_update_message_exists(org: Organization, expected_count: int):
    outbox_messages = RegionOutbox.objects.filter()

    # TODO(HC): Remove this once we can ensure an expected count of 1 for every message
    #  It's not essential since these messages will coallesce, but there's no reason we
    #  should be queueing 2 outbox messages per create/update
    assert outbox_messages.count() == expected_count
    for org_update_outbox in outbox_messages:
        assert org_update_outbox.shard_identifier == org.id
        assert org_update_outbox.shard_scope == OutboxScope.ORGANIZATION_SCOPE
        assert org_update_outbox.category == OutboxCategory.ORGANIZATION_UPDATE


@region_silo_test(stable=True)
class OrganizationUpdateTest(TestCase):
    def setUp(self):
        self.org: Organization = self.create_organization(slug="sluggy", name="barfoo")

    def assert_slug_matches(self, slug: str, expected_slug_root: str, partial_match: bool = False):
        slug_matcher = expected_slug_root
        if SiloMode.get_current_mode() == SiloMode.REGION:
            slug_matcher = f"r-na-{expected_slug_root}"

        if partial_match:
            assert slug.startswith(slug_matcher)
        else:
            assert slug == slug_matcher

    def test_create_organization_with_outbox_message(self):
        with outbox_context(flush=False):
            org: Organization = create_organization_with_outbox_message(
                create_options={
                    "slug": "santry",
                    "name": "santry",
                    "status": OrganizationStatus.ACTIVE,
                }
            )

        assert org.id
        assert org.name == "santry"
        self.assert_slug_matches(org.slug, "santry")
        assert_outbox_update_message_exists(org=org, expected_count=1)


@region_silo_test(stable=True)
class OrganizationUpdateWithOutboxTest(TestCase):
    def setUp(self):
        self.org: Organization = self.create_organization(slug="sluggy", name="barfoo")

    def test_update_organization_with_outbox_message(self):
        with outbox_context(flush=False):
            update_organization_with_outbox_message(
                org_id=self.org.id, update_data={"name": "foobar"}
            )

        self.org.refresh_from_db()
        assert self.org.name == "foobar"
        assert self.org.slug == "sluggy"
        assert_outbox_update_message_exists(org=self.org, expected_count=1)

    def test_update_with_missing_org_id(self):
        with pytest.raises(Organization.DoesNotExist):
            update_organization_with_outbox_message(org_id=1234, update_data={"name": "foobar"})


@region_silo_test(stable=True)
class OrganizationUpsertWithOutboxTest(TestCase):
    def setUp(self):
        self.org: Organization = self.create_organization(slug="sluggy", name="barfoo")

    def test_upsert_queues_outbox_message_and_updates_org(self):
        # The test fixture creates at least 1 org so comparing count before
        # and after the upsert is the safest way to assert we haven't created
        # a new entry.
        previous_org_count = Organization.objects.count()
        org_before_modification = Organization.objects.get(id=self.org.id)

        with outbox_context(flush=False):
            updated_org: Organization = upsert_organization_by_org_id_with_outbox_message(
                org_id=self.org.id,
                upsert_data={
                    "slug": "foobar",
                    "status": OrganizationStatus.DELETION_IN_PROGRESS,
                },
            )

        assert Organization.objects.count() == previous_org_count
        self.org.refresh_from_db()
        assert updated_org.slug == self.org.slug == "foobar"
        assert updated_org.name == self.org.name == "barfoo"
        assert updated_org.status == self.org.status == OrganizationStatus.DELETION_IN_PROGRESS

        assert (
            updated_org.default_role
            == self.org.default_role
            == org_before_modification.default_role
        )

        assert_outbox_update_message_exists(org=self.org, expected_count=1)

    def test_upsert_creates_organization_with_desired_id(self):
        previous_org_count = Organization.objects.count()
        org_before_modification = Organization.objects.get(id=self.org.id)
        desired_org_id = 1234

        with outbox_context(flush=False):
            created_org: Organization = upsert_organization_by_org_id_with_outbox_message(
                org_id=desired_org_id,
                upsert_data={
                    "slug": "random",
                    "name": "rando",
                    "status": OrganizationStatus.ACTIVE,
                },
            )
        assert Organization.objects.count() == previous_org_count + 1
        db_created_org = Organization.objects.get(id=desired_org_id)
        assert db_created_org.slug == created_org.slug == "random"
        assert db_created_org.status == created_org.status == OrganizationStatus.ACTIVE
        assert db_created_org.name == created_org.name == "rando"

        # Probably overly cautious, but assert that previous org has not been modified
        self.org.refresh_from_db()
        assert org_before_modification.slug == self.org.slug
        assert org_before_modification.name == self.org.name
        assert org_before_modification.status == self.org.status
        assert_outbox_update_message_exists(org=db_created_org, expected_count=1)


@region_silo_test(stable=True)
class OrganizationMarkOrganizationAsPendingDeletionWithOutboxMessageTest(TestCase):
    def setUp(self):
        self.org: Organization = self.create_organization(
            slug="sluggy", name="barfoo", status=OrganizationStatus.ACTIVE
        )

    def test_mark_for_deletion_and_outbox_generation(self):
        org_before_update = Organization.objects.get(id=self.org.id)

        with outbox_context(flush=False):
            updated_org = mark_organization_as_pending_deletion_with_outbox_message(
                org_id=self.org.id
            )

        assert updated_org
        self.org.refresh_from_db()
        assert updated_org.status == self.org.status == OrganizationStatus.PENDING_DELETION
        assert updated_org.name == self.org.name == org_before_update.name
        assert updated_org.slug == self.org.slug == org_before_update.slug

        assert_outbox_update_message_exists(self.org, 1)

    def test_mark_for_deletion_on_already_deleted_org(self):
        self.org.status = OrganizationStatus.PENDING_DELETION
        self.org.save()

        org_before_update = Organization.objects.get(id=self.org.id)

        with outbox_context(flush=False):
            updated_org = mark_organization_as_pending_deletion_with_outbox_message(
                org_id=self.org.id
            )

        assert updated_org is None

        self.org.refresh_from_db()
        assert self.org.status == org_before_update.status
        assert self.org.name == org_before_update.name
        assert self.org.slug == org_before_update.slug

        assert_outbox_update_message_exists(self.org, 0)


@region_silo_test(stable=True)
class UnmarkOrganizationForDeletionWithOutboxMessageTest(TestCase):
    def setUp(self):
        self.org: Organization = self.create_organization(
            slug="sluggy", name="barfoo", status=OrganizationStatus.PENDING_DELETION
        )

    def test_unmark_for_pending_deletion_and_outbox_generation(self):
        with outbox_context(flush=False):
            updated_org = unmark_organization_as_pending_deletion_with_outbox_message(
                org_id=self.org.id
            )

        assert updated_org
        self.org.refresh_from_db()

        assert updated_org.status == self.org.status == OrganizationStatus.ACTIVE
        assert updated_org.name == self.org.name
        assert updated_org.slug == self.org.slug

        assert_outbox_update_message_exists(self.org, 1)

    def test_unmark_for_deletion_in_progress_and_outbox_generation(self):
        update_organization_with_outbox_message(
            org_id=self.org.id, update_data={"status": OrganizationStatus.DELETION_IN_PROGRESS}
        )

        with outbox_context(flush=False):
            updated_org = unmark_organization_as_pending_deletion_with_outbox_message(
                org_id=self.org.id
            )

        assert updated_org
        self.org.refresh_from_db()

        assert updated_org.status == self.org.status == OrganizationStatus.ACTIVE
        assert updated_org.name == self.org.name
        assert updated_org.slug == self.org.slug

        assert_outbox_update_message_exists(self.org, 1)

    def test_unmark_org_when_already_active(self):
        update_organization_with_outbox_message(
            org_id=self.org.id, update_data={"status": OrganizationStatus.ACTIVE}
        )

        org_before_update = Organization.objects.get(id=self.org.id)

        with outbox_context(flush=False):
            updated_org = unmark_organization_as_pending_deletion_with_outbox_message(
                org_id=self.org.id
            )

        assert not updated_org

        self.org.refresh_from_db()
        assert self.org.status == org_before_update.status
        assert self.org.name == org_before_update.name
        assert self.org.slug == org_before_update.slug
        assert_outbox_update_message_exists(self.org, 0)
