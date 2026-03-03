"""
Tests for subscription cancellation.

These tests verify that subscription cancellation operations work correctly
with proper locking and fresh database values.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch

from sentry.billing.cancel import (
    cancel_subscription_at_period_end,
    reactivate_subscription,
)
from sentry.billing.models import BillingSubscription
from sentry.testutils.cases import TestCase


class CancelSubscriptionTest(TestCase):
    """Test the cancel_subscription_at_period_end function."""

    def setUp(self):
        super().setUp()
        self.subscription = BillingSubscription.objects.create(
            organization_id=1,
            plan="basic",
            billing_period_end=datetime(2026, 4, 1, tzinfo=timezone.utc),
            quantity=1,
            cancel_at_period_end=False,
        )

    def test_cancel_subscription_at_period_end(self):
        """Test that cancel_subscription_at_period_end sets the flag."""
        cancel_subscription_at_period_end(self.subscription)

        self.subscription.refresh_from_db()
        assert self.subscription.cancel_at_period_end is True

    def test_cancel_subscription_at_period_end_idempotent(self):
        """Test that cancelling an already-cancelled subscription is idempotent."""
        # Cancel once
        cancel_subscription_at_period_end(self.subscription)
        self.subscription.refresh_from_db()
        assert self.subscription.cancel_at_period_end is True

        # Cancel again - should not error
        cancel_subscription_at_period_end(self.subscription)
        self.subscription.refresh_from_db()
        assert self.subscription.cancel_at_period_end is True

    def test_cancel_subscription_with_lock(self):
        """Test that cancel_subscription_at_period_end uses the lock decorator."""
        with patch.object(
            BillingSubscription, "refresh_from_db", wraps=self.subscription.refresh_from_db
        ) as mock_refresh:
            cancel_subscription_at_period_end(self.subscription)

            # The lock decorator should call refresh_from_db
            assert mock_refresh.called

    def test_cancel_subscription_does_not_change_other_fields(self):
        """Test that cancellation doesn't affect other fields."""
        original_plan = self.subscription.plan
        original_quantity = self.subscription.quantity
        original_billing_period_end = self.subscription.billing_period_end

        cancel_subscription_at_period_end(self.subscription)

        self.subscription.refresh_from_db()
        assert self.subscription.plan == original_plan
        assert self.subscription.quantity == original_quantity
        assert self.subscription.billing_period_end == original_billing_period_end
        assert self.subscription.cancel_at_period_end is True

    def test_cancel_subscription_with_concurrent_modification(self):
        """
        Test that cancellation works even if subscription is modified concurrently.

        This verifies that @subscription_lock's refresh_from_db() prevents issues.
        """
        # Simulate another process modifying the subscription
        BillingSubscription.objects.filter(id=self.subscription.id).update(
            plan="modified_by_other_process"
        )

        # Should succeed because @subscription_lock calls refresh_from_db()
        cancel_subscription_at_period_end(self.subscription)

        self.subscription.refresh_from_db()
        assert self.subscription.cancel_at_period_end is True


class ReactivateSubscriptionTest(TestCase):
    """Test the reactivate_subscription function."""

    def setUp(self):
        super().setUp()
        self.subscription = BillingSubscription.objects.create(
            organization_id=1,
            plan="basic",
            billing_period_end=datetime(2026, 4, 1, tzinfo=timezone.utc),
            quantity=1,
            cancel_at_period_end=True,  # Start as cancelled
        )

    def test_reactivate_subscription(self):
        """Test that reactivate_subscription clears the cancellation flag."""
        reactivate_subscription(self.subscription)

        self.subscription.refresh_from_db()
        assert self.subscription.cancel_at_period_end is False

    def test_reactivate_subscription_idempotent(self):
        """Test that reactivating an active subscription is idempotent."""
        # Reactivate once
        reactivate_subscription(self.subscription)
        self.subscription.refresh_from_db()
        assert self.subscription.cancel_at_period_end is False

        # Reactivate again - should not error
        reactivate_subscription(self.subscription)
        self.subscription.refresh_from_db()
        assert self.subscription.cancel_at_period_end is False

    def test_reactivate_subscription_with_lock(self):
        """Test that reactivate_subscription uses the lock decorator."""
        with patch.object(
            BillingSubscription, "refresh_from_db", wraps=self.subscription.refresh_from_db
        ) as mock_refresh:
            reactivate_subscription(self.subscription)

            # The lock decorator should call refresh_from_db
            assert mock_refresh.called

    def test_reactivate_subscription_does_not_change_other_fields(self):
        """Test that reactivation doesn't affect other fields."""
        original_plan = self.subscription.plan
        original_quantity = self.subscription.quantity
        original_billing_period_end = self.subscription.billing_period_end

        reactivate_subscription(self.subscription)

        self.subscription.refresh_from_db()
        assert self.subscription.plan == original_plan
        assert self.subscription.quantity == original_quantity
        assert self.subscription.billing_period_end == original_billing_period_end
        assert self.subscription.cancel_at_period_end is False
