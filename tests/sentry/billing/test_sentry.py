from datetime import timedelta

from django.utils import timezone

from sentry.billing.config import UsageCategoryId
from sentry.billing.sentry import SentryUsageTrackingService
from sentry.testutils.cases import TestCase


class TestSentryUsageTrackingService(TestCase):
    def setUp(self):
        self.service = SentryUsageTrackingService()

        self.organization_id = 1
        self.project_id = 2

        self.timestamp = timezone.now() - timedelta(hours=1)
        self.before_timestamp = self.timestamp - timedelta(minutes=30)
        self.after_timestamp = self.timestamp + timedelta(minutes=30)

    def test_record_and_read_basic_usage(self):
        self.service.record_usage(
            org_id=self.organization_id,
            usage_category_id=UsageCategoryId.ERROR_ACCEPTED,
            properties={"project_id": self.project_id, "quantity": 3},
            timestamp=self.timestamp,
        )

        result = self.service.get_aggregated_usage(
            org_id=self.organization_id,
            usage_category_ids=[UsageCategoryId.ERROR_ACCEPTED],
            start=self.before_timestamp,
            end=self.after_timestamp,
            values=["sum(quantity)"],
        )

        # TODO: Verify actual results, not shape
        assert isinstance(result, dict)
        assert UsageCategoryId.ERROR_ACCEPTED in result
        assert isinstance(result[UsageCategoryId.ERROR_ACCEPTED], list)

    def test_record_and_read_with_filtering(self):
        key_id = 12345
        timestamp = timezone.now() - timedelta(hours=1)

        self.service.record_usage(
            org_id=self.organization_id,
            usage_category_id=UsageCategoryId.ERROR_FILTERED,
            properties={
                "project_id": self.project_id,
                "key_id": key_id,
                "reason": "test_filter",
                "quantity": 2,
            },
            timestamp=timestamp,
        )

        result = self.service.get_aggregated_usage(
            org_id=self.organization_id,
            usage_category_ids=[UsageCategoryId.ERROR_FILTERED],
            start=self.before_timestamp,
            end=self.after_timestamp,
            filter_properties={
                "project_id": self.project_id,
                "key_id": key_id,
                "reason": "test_filter",
            },
            values=["sum(quantity)"],
        )

        # TODO: Verify actual results, not shape
        assert isinstance(result, dict)
        assert UsageCategoryId.ERROR_FILTERED in result

    def test_record_and_read_multiple_categories(self):
        timestamp = timezone.now() - timedelta(hours=1)

        categories_to_record = [UsageCategoryId.ERROR_ACCEPTED, UsageCategoryId.ERROR_RATE_LIMITED]

        for category in categories_to_record:
            self.service.record_usage(
                org_id=self.organization_id,
                usage_category_id=category,
                properties={"project_id": self.project_id},
                timestamp=timestamp,
            )

        result = self.service.get_aggregated_usage(
            org_id=self.organization_id,
            usage_category_ids=categories_to_record,
            start=self.before_timestamp,
            end=self.after_timestamp,
            values=["sum(quantity)"],
        )

        # TODO: Verify actual results, not shape
        assert isinstance(result, dict)
        assert len(result) == len(categories_to_record)
        for category in categories_to_record:
            assert category in result
            assert isinstance(result[category], list)
