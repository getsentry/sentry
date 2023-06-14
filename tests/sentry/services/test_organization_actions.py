import pytest

from sentry.models import (
    Organization,
    OrganizationStatus,
    OutboxCategory,
    OutboxScope,
    RegionOutbox,
)
from sentry.services.hybrid_cloud.organization_actions.impl import (
    create_organization_with_outbox_message,
    update_organization_with_outbox_message,
    upsert_organization_by_org_id_with_outbox_message,
)
from sentry.testutils import TestCase
from sentry.testutils.outbox import outbox_runner
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

        with outbox_runner():
            pass

    def test_create_organization_with_outbox_message(self):
        with outbox_runner():
            pass

        org: Organization = create_organization_with_outbox_message(
            create_options={"slug": "santry", "name": "santry", "status": OrganizationStatus.ACTIVE}
        )

        assert org.id
        assert org.slug == "santry"
        assert org.name == "santry"
        assert_outbox_update_message_exists(org=org, expected_count=2)


@region_silo_test(stable=True)
class OrganizationUpdateWithOutboxTest(TestCase):
    def setUp(self):
        self.org: Organization = self.create_organization(slug="sluggy", name="barfoo")

        with outbox_runner():
            pass

    def test_update_organization_with_outbox_message(self):
        update_organization_with_outbox_message(org_id=self.org.id, update_data={"name": "foobar"})

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

        with outbox_runner():
            pass

    def test_upsert_queues_outbox_message_and_updates_org(self):
        # The test fixture creates at least 1 org so comparing count before
        # and after the upsert is the safest way to assert we haven't created
        # a new entry.
        previous_org_count = Organization.objects.count()
        org_before_modification = Organization.objects.get(id=self.org.id)
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

        assert_outbox_update_message_exists(org=self.org, expected_count=2)

    def test_upsert_creates_organization_with_desired_id(self):
        previous_org_count = Organization.objects.count()
        org_before_modification = Organization.objects.get(id=self.org.id)
        desired_org_id = 1234

        created_org: Organization = upsert_organization_by_org_id_with_outbox_message(
            org_id=desired_org_id,
            upsert_data={"slug": "random", "name": "rando", "status": OrganizationStatus.ACTIVE},
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
        assert_outbox_update_message_exists(org=db_created_org, expected_count=2)
