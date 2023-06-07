import dataclasses
from datetime import datetime, timedelta
from typing import ContextManager
from unittest.mock import call, patch

import pytest
import responses
from django.conf import settings
from django.test import RequestFactory
from freezegun import freeze_time
from pytest import raises
from rest_framework import status

from sentry.models import (
    ControlOutbox,
    Organization,
    OrganizationMapping,
    OrganizationMember,
    OutboxCategory,
    OutboxScope,
    RegionOutbox,
    User,
    WebhookProviderIdentifier,
)
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.silo import SiloMode
from sentry.tasks.deliver_from_outbox import enqueue_outbox_jobs
from sentry.testutils import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.region import override_regions
from sentry.testutils.silo import control_silo_test, exempt_from_silo_limits, region_silo_test
from sentry.types.region import Region, RegionCategory


@pytest.fixture(autouse=True, scope="function")
@pytest.mark.django_db(transaction=True)
def setup_clear_fixture_outbox_messages():
    with outbox_runner():
        pass


@control_silo_test(stable=True)
class ControlOutboxTest(TestCase):
    webhook_request = RequestFactory().post(
        "/extensions/github/webhook/",
        data={"installation": {"id": "github:1"}},
        content_type="application/json",
        HTTP_X_GITHUB_EMOTICON=">:^]",
    )
    region = Region("eu", 1, "http://eu.testserver", RegionCategory.MULTI_TENANT)
    region_config = (region,)

    def test_creating_user_outboxes(self):
        with exempt_from_silo_limits():
            org = Factories.create_organization()

            org_mapping = OrganizationMapping.objects.get(organization_id=org.id)
            org_mapping.region_name = "a"
            org_mapping.save()

            org2 = Factories.create_organization()

            org_mapping2 = OrganizationMapping.objects.get(organization_id=org2.id)
            org_mapping2.region_name = "b"
            org_mapping2.save()

            user1 = Factories.create_user()
            organization_service.add_organization_member(
                organization_id=org.id,
                default_org_role=org.default_role,
                user_id=user1.id,
            )

            organization_service.add_organization_member(
                organization_id=org2.id,
                default_org_role=org2.default_role,
                user_id=user1.id,
            )

        for outbox in User.outboxes_for_user_update(user1.id):
            outbox.save()

        assert ControlOutbox.objects.count() > 0

    def test_control_sharding_keys(self):
        request = RequestFactory().get("/extensions/slack/webhook/")
        with exempt_from_silo_limits():
            org = Factories.create_organization()

        user1 = Factories.create_user()
        user2 = Factories.create_user()
        organization_service.add_organization_member(
            organization_id=org.id,
            default_org_role=org.default_role,
            user_id=user1.id,
        )
        organization_service.add_organization_member(
            organization_id=org.id,
            default_org_role=org.default_role,
            user_id=user2.id,
        )

        for inst in User.outboxes_for_user_update(user1.id):
            inst.save()
        for inst in User.outboxes_for_user_update(user2.id):
            inst.save()

        for inst in ControlOutbox.for_webhook_update(
            webhook_identifier=WebhookProviderIdentifier.SLACK,
            region_names=[settings.SENTRY_MONOLITH_REGION, "special-slack-region"],
            request=request,
        ):
            inst.save()

        for inst in ControlOutbox.for_webhook_update(
            webhook_identifier=WebhookProviderIdentifier.GITHUB,
            region_names=[settings.SENTRY_MONOLITH_REGION, "special-github-region"],
            request=request,
        ):
            inst.save()

        shards = {
            (row["shard_scope"], row["shard_identifier"], row["region_name"])
            for row in ControlOutbox.find_scheduled_shards()
        }

        assert shards == {
            (OutboxScope.USER_SCOPE.value, user1.id, settings.SENTRY_MONOLITH_REGION),
            (OutboxScope.USER_SCOPE.value, user2.id, settings.SENTRY_MONOLITH_REGION),
            (
                OutboxScope.WEBHOOK_SCOPE.value,
                WebhookProviderIdentifier.SLACK,
                settings.SENTRY_MONOLITH_REGION,
            ),
            (
                OutboxScope.WEBHOOK_SCOPE.value,
                WebhookProviderIdentifier.GITHUB,
                settings.SENTRY_MONOLITH_REGION,
            ),
            (
                OutboxScope.WEBHOOK_SCOPE.value,
                WebhookProviderIdentifier.SLACK,
                "special-slack-region",
            ),
            (
                OutboxScope.WEBHOOK_SCOPE.value,
                WebhookProviderIdentifier.GITHUB,
                "special-github-region",
            ),
        }

    def test_control_outbox_for_webhooks(self):
        [outbox] = ControlOutbox.for_webhook_update(
            webhook_identifier=WebhookProviderIdentifier.GITHUB,
            region_names=["webhook-region"],
            request=self.webhook_request,
        )
        assert outbox.shard_scope == OutboxScope.WEBHOOK_SCOPE
        assert outbox.shard_identifier == WebhookProviderIdentifier.GITHUB
        assert outbox.category == OutboxCategory.WEBHOOK_PROXY
        assert outbox.region_name == "webhook-region"

        payload_from_request = outbox.get_webhook_payload_from_request(self.webhook_request)
        assert outbox.payload == dataclasses.asdict(payload_from_request)
        payload_from_outbox = outbox.get_webhook_payload_from_outbox(outbox.payload)
        assert payload_from_request == payload_from_outbox

        assert outbox.payload["method"] == "POST"
        assert outbox.payload["path"] == "/extensions/github/webhook/"
        assert outbox.payload["uri"] == "http://testserver/extensions/github/webhook/"
        # Request factory expects transformed headers, but the outbox stores raw headers
        assert outbox.payload["headers"]["X-Github-Emoticon"] == ">:^]"
        assert outbox.payload["body"] == '{"installation": {"id": "github:1"}}'

        # After saving, data shouldn't mutate
        outbox.save()
        outbox = ControlOutbox.objects.all().first()
        assert outbox.payload["method"] == "POST"
        assert outbox.payload["path"] == "/extensions/github/webhook/"
        assert outbox.payload["uri"] == "http://testserver/extensions/github/webhook/"
        # Request factory expects transformed headers, but the outbox stores raw headers
        assert outbox.payload["headers"]["X-Github-Emoticon"] == ">:^]"
        assert outbox.payload["body"] == '{"installation": {"id": "github:1"}}'

    @responses.activate
    def test_drains_successful_success(self):
        with override_regions(self.region_config):
            mock_response = responses.add(
                self.webhook_request.method,
                f"{self.region.address}{self.webhook_request.path}",
                status=status.HTTP_200_OK,
            )
            expected_request_count = 1 if SiloMode.get_current_mode() == SiloMode.CONTROL else 0
            [outbox] = ControlOutbox.for_webhook_update(
                webhook_identifier=WebhookProviderIdentifier.GITHUB,
                region_names=[self.region.name],
                request=self.webhook_request,
            )
            outbox.save()

            assert ControlOutbox.objects.filter(id=outbox.id).exists()
            outbox.drain_shard()
            assert mock_response.call_count == expected_request_count
            assert not ControlOutbox.objects.filter(id=outbox.id).exists()

    @responses.activate
    def test_drains_webhook_failure(self):
        with override_regions(self.region_config):
            mock_response = responses.add(
                self.webhook_request.method,
                f"{self.region.address}{self.webhook_request.path}",
                status=status.HTTP_502_BAD_GATEWAY,
            )
            [outbox] = ControlOutbox.for_webhook_update(
                webhook_identifier=WebhookProviderIdentifier.GITHUB,
                region_names=[self.region.name],
                request=self.webhook_request,
            )
            outbox.save()

            assert ControlOutbox.objects.filter(id=outbox.id).exists()
            if SiloMode.get_current_mode() == SiloMode.CONTROL:
                with raises(ApiError):
                    outbox.drain_shard()
                assert mock_response.call_count == 1
                assert ControlOutbox.objects.filter(id=outbox.id).exists()
            else:
                outbox.drain_shard()
                assert mock_response.call_count == 0
                assert not ControlOutbox.objects.filter(id=outbox.id).exists()


@region_silo_test(stable=True)
class RegionOutboxTest(TestCase):
    def test_creating_org_outboxes(self):
        Organization.outbox_for_update(10).save()
        OrganizationMember(organization_id=12, id=15).outbox_for_update().save()
        assert RegionOutbox.objects.count() == 2

        with exempt_from_silo_limits(), outbox_runner():
            # drain outboxes
            pass
        assert RegionOutbox.objects.count() == 0

    @patch("sentry.models.outbox.metrics")
    def test_concurrent_coalesced_object_processing(self, mock_metrics):
        # Two objects coalesced
        outbox = OrganizationMember(id=1, organization_id=1).outbox_for_update()
        outbox.save()
        OrganizationMember(id=1, organization_id=1).outbox_for_update().save()

        # Unrelated
        OrganizationMember(organization_id=1, id=2).outbox_for_update().save()
        OrganizationMember(organization_id=2, id=2).outbox_for_update().save()

        assert len(list(RegionOutbox.find_scheduled_shards())) == 2

        ctx: ContextManager = outbox.process_coalesced()
        try:
            ctx.__enter__()
            assert RegionOutbox.objects.count() == 4
            assert outbox.select_coalesced_messages().count() == 2

            # concurrent write of coalesced object update.
            OrganizationMember(organization_id=1, id=1).outbox_for_update().save()
            assert RegionOutbox.objects.count() == 5
            assert outbox.select_coalesced_messages().count() == 3

            ctx.__exit__(None, None, None)

            # does not remove the concurrent write, which is still going to update.
            assert RegionOutbox.objects.count() == 3
            assert outbox.select_coalesced_messages().count() == 1
            assert len(list(RegionOutbox.find_scheduled_shards())) == 2

            expected = [
                call("outbox.saved", 1, tags={"category": "ORGANIZATION_MEMBER_UPDATE"}),
                call("outbox.saved", 1, tags={"category": "ORGANIZATION_MEMBER_UPDATE"}),
                call("outbox.saved", 1, tags={"category": "ORGANIZATION_MEMBER_UPDATE"}),
                call("outbox.saved", 1, tags={"category": "ORGANIZATION_MEMBER_UPDATE"}),
                call("outbox.saved", 1, tags={"category": "ORGANIZATION_MEMBER_UPDATE"}),
                call("outbox.processed", 2, tags={"category": "ORGANIZATION_MEMBER_UPDATE"}),
            ]
            assert mock_metrics.incr.mock_calls == expected
        except Exception as e:
            ctx.__exit__(type(e), e, None)
            raise e

    def test_outbox_rescheduling(self):
        with patch("sentry.models.outbox.process_region_outbox.send") as mock_process_region_outbox:

            def raise_exception(**kwds):
                raise ValueError("This is just a test mock exception")

            def run_with_error():
                mock_process_region_outbox.side_effect = raise_exception
                mock_process_region_outbox.reset_mock()
                with self.tasks():
                    with raises(ValueError):
                        enqueue_outbox_jobs()
                    assert mock_process_region_outbox.call_count == 1

            def ensure_converged():
                mock_process_region_outbox.reset_mock()
                with self.tasks():
                    enqueue_outbox_jobs()
                    assert mock_process_region_outbox.call_count == 0

            def assert_called_for_org(org):
                mock_process_region_outbox.assert_called_with(
                    sender=OutboxCategory.ORGANIZATION_UPDATE,
                    payload=None,
                    object_identifier=org,
                    shard_identifier=org,
                )

            Organization.outbox_for_update(org_id=10001).save()
            Organization.outbox_for_update(org_id=10002).save()

            start_time = datetime(2022, 10, 1, 0)
            with freeze_time(start_time):
                run_with_error()
                assert_called_for_org(10001)

            # Runs things in ascending order of the scheduled_for
            with freeze_time(start_time + timedelta(minutes=10)):
                run_with_error()
                assert_called_for_org(10002)

            # Has rescheduled all objects into the future.
            with freeze_time(start_time):
                ensure_converged()

            # Next would run the original rescheduled org1 entry
            with freeze_time(start_time + timedelta(minutes=10)):
                run_with_error()
                assert_called_for_org(10001)
                ensure_converged()

                # Concurrently added items still follow the largest retry schedule
                Organization.outbox_for_update(10002).save()
                ensure_converged()

    def test_outbox_converges(self):
        with patch("sentry.models.outbox.process_region_outbox.send") as mock_process_region_outbox:
            Organization.outbox_for_update(10001).save()
            Organization.outbox_for_update(10001).save()

            Organization.outbox_for_update(10002).save()
            Organization.outbox_for_update(10002).save()

            last_call_count = 0
            while True:
                with self.tasks():
                    enqueue_outbox_jobs()
                    if last_call_count == mock_process_region_outbox.call_count:
                        break
                    last_call_count = mock_process_region_outbox.call_count

            assert last_call_count == 2

    def test_region_sharding_keys(self):
        org1 = Factories.create_organization()
        org2 = Factories.create_organization()

        Organization.outbox_for_update(org1.id).save()
        Organization.outbox_for_update(org2.id).save()

        OrganizationMember(organization_id=org1.id, id=1).outbox_for_update().save()
        OrganizationMember(organization_id=org2.id, id=2).outbox_for_update().save()

        shards = {
            (row["shard_scope"], row["shard_identifier"])
            for row in RegionOutbox.find_scheduled_shards()
        }
        assert shards == {
            (OutboxScope.ORGANIZATION_SCOPE.value, org1.id),
            (OutboxScope.ORGANIZATION_SCOPE.value, org2.id),
        }
