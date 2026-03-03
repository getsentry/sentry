"""
Tests for subscription change application.

These tests verify that subscription changes are applied correctly with
proper locking and fresh database values.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch

from sentry.billing.apply_subscription_change import (
    apply_subscription_change,
    update_subscription_quantity,
)
from sentry.billing.models import BillingSubscription
from sentry.testutils.cases import TestCase


class ApplySubscriptionChangeTest(TestCase):
    """Test the apply_subscription_change function."""

    def setUp(self):
        super().setUp()
        self.subscription = BillingSubscription.objects.create(
            organization_id=1,
            plan="basic",
            billing_period_end=datetime(2026, 4, 1, tzinfo=timezone.utc),
            quantity=1,
        )

    def test_apply_subscription_change_updates_plan(self):
        """Test that apply_subscription_change updates the plan."""
        new_date = datetime(2026, 5, 1, tzinfo=timezone.utc)

        apply_subscription_change(
            self.subscription,
            new_plan="premium",
            new_billing_period_end=new_date,
        )

        # Reload from database
        self.subscription.refresh_from_db()
        assert self.subscription.plan == "premium"
        assert self.subscription.billing_period_end == new_date

    def test_apply_subscription_change_with_lock(self):
        """Test that apply_subscription_change uses the lock decorator."""
        new_date = datetime(2026, 5, 1, tzinfo=timezone.utc)

        # Verify that refresh_from_db is called (indicating lock decorator worked)
        with patch.object(
            BillingSubscription, "refresh_from_db", wraps=self.subscription.refresh_from_db
        ) as mock_refresh:
            apply_subscription_change(
                self.subscription,
                new_plan="premium",
                new_billing_period_end=new_date,
            )

            # The lock decorator should call refresh_from_db
            assert mock_refresh.called

    def test_apply_subscription_change_with_concurrent_modification(self):
        """
        Test that apply_subscription_change works even if subscription is modified
        before the function executes.

        This simulates:
        1. Read subscription
        2. Another process modifies it
        3. apply_subscription_change is called
        4. The lock decorator refreshes the subscription, so it should succeed
        """
        new_date = datetime(2026, 5, 1, tzinfo=timezone.utc)

        # Simulate another process modifying the subscription
        BillingSubscription.objects.filter(id=self.subscription.id).update(
            plan="modified_by_other_process"
        )

        # This should succeed because @subscription_lock calls refresh_from_db()
        apply_subscription_change(
            self.subscription,
            new_plan="premium",
            new_billing_period_end=new_date,
        )

        self.subscription.refresh_from_db()
        assert self.subscription.plan == "premium"
        assert self.subscription.billing_period_end == new_date


class UpdateSubscriptionQuantityTest(TestCase):
    """Test the update_subscription_quantity function."""

    def setUp(self):
        super().setUp()
        self.subscription = BillingSubscription.objects.create(
            organization_id=1,
            plan="basic",
            billing_period_end=datetime(2026, 4, 1, tzinfo=timezone.utc),
            quantity=1,
        )

    def test_update_subscription_quantity(self):
        """Test that update_subscription_quantity updates the quantity."""
        update_subscription_quantity(self.subscription, new_quantity=10)

        self.subscription.refresh_from_db()
        assert self.subscription.quantity == 10

    def test_update_subscription_quantity_with_lock(self):
        """Test that update_subscription_quantity uses the lock decorator."""
        with patch.object(
            BillingSubscription, "refresh_from_db", wraps=self.subscription.refresh_from_db
        ) as mock_refresh:
            update_subscription_quantity(self.subscription, new_quantity=5)

            # The lock decorator should call refresh_from_db
            assert mock_refresh.called

    def test_update_subscription_quantity_does_not_change_other_fields(self):
        """Test that updating quantity doesn't affect other fields."""
        original_plan = self.subscription.plan
        original_billing_period_end = self.subscription.billing_period_end

        update_subscription_quantity(self.subscription, new_quantity=10)

        self.subscription.refresh_from_db()
        assert self.subscription.plan == original_plan
        assert self.subscription.billing_period_end == original_billing_period_end
        assert self.subscription.quantity == 10
