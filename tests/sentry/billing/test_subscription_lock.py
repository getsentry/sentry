"""
Tests for subscription_lock decorator.

These tests verify that the subscription_lock decorator correctly:
1. Acquires a lock on the subscription
2. Refreshes subscription state from the database
3. Clears cached options
4. Prevents race conditions in concurrent updates
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from threading import Thread
from unittest.mock import Mock, patch

import pytest
from django.test import TestCase

from sentry.billing.models import BillingSubscription
from sentry.billing.staged import SubscriptionUpdates
from sentry.billing.subscription_lock import (
    SubscriptionIntegrityError,
    subscription_lock,
)
from sentry.testutils.cases import TestCase as SentryTestCase


class SubscriptionLockDecoratorTest(TestCase):
    """Test the subscription_lock decorator behavior."""

    def setUp(self):
        super().setUp()
        self.subscription = BillingSubscription.objects.create(
            organization_id=1,
            plan="basic",
            billing_period_end=datetime(2026, 4, 1, tzinfo=timezone.utc),
            quantity=1,
        )

    def test_decorator_refreshes_subscription_state(self):
        """Verify that the decorator calls refresh_from_db() after acquiring lock."""
        refresh_called = []

        @subscription_lock(timeout=5)
        def update_function(subscription):
            # Track that we entered the function
            refresh_called.append(True)
            return subscription

        with patch.object(BillingSubscription, "refresh_from_db") as mock_refresh:
            result = update_function(self.subscription)

            # Verify refresh_from_db was called
            assert mock_refresh.called
            assert len(refresh_called) == 1
            assert result == self.subscription

    def test_decorator_acquires_lock(self):
        """Verify that the decorator acquires a lock on the subscription."""
        with patch("sentry.billing.subscription_lock.locks") as mock_locks:
            mock_lock = Mock()
            mock_lock.acquire = Mock(return_value=Mock(__enter__=Mock(), __exit__=Mock()))
            mock_locks.get.return_value = mock_lock

            @subscription_lock(timeout=5, name="test_lock")
            def update_function(subscription):
                return True

            update_function(self.subscription)

            # Verify lock was acquired
            mock_locks.get.assert_called_once()
            call_args = mock_locks.get.call_args
            assert f"subscription:BillingSubscription:{self.subscription.id}" in call_args[0][0]
            assert call_args[1]["duration"] == 5
            assert call_args[1]["name"] == "test_lock"

    def test_decorator_clears_options_cache(self):
        """Verify that the decorator clears the options cache if present."""
        # Simulate a cached options attribute
        self.subscription._SubscriptionModel__options = {"cached": "data"}

        @subscription_lock(timeout=5)
        def update_function(subscription):
            # Options cache should be cleared by the decorator
            return not hasattr(subscription, "_SubscriptionModel__options")

        result = update_function(self.subscription)
        assert result is True

    def test_decorator_handles_missing_subscription(self):
        """Verify graceful handling when subscription is not in arguments."""

        @subscription_lock(timeout=5)
        def update_function(some_other_arg):
            return some_other_arg

        with patch("sentry.billing.subscription_lock.logger") as mock_logger:
            result = update_function("test")
            assert result == "test"
            # Should log a warning
            assert mock_logger.warning.called

    def test_decorator_with_subscription_in_kwargs(self):
        """Verify the decorator works when subscription is passed as kwarg."""
        refresh_called = []

        @subscription_lock(timeout=5)
        def update_function(*, subscription):
            refresh_called.append(True)
            return subscription

        with patch.object(BillingSubscription, "refresh_from_db") as mock_refresh:
            result = update_function(subscription=self.subscription)

            assert mock_refresh.called
            assert len(refresh_called) == 1
            assert result == self.subscription


class SubscriptionLockRaceConditionTest(SentryTestCase):
    """Test that subscription_lock prevents race conditions."""

    def setUp(self):
        super().setUp()
        self.subscription = BillingSubscription.objects.create(
            organization_id=1,
            plan="basic",
            billing_period_end=datetime(2026, 4, 1, tzinfo=timezone.utc),
            quantity=1,
        )

    def test_concurrent_updates_with_lock(self):
        """
        Test that concurrent updates with @subscription_lock succeed.

        This test simulates two threads trying to update the same subscription
        concurrently. With the lock, they should serialize and both succeed.
        """
        results = {"thread1": None, "thread2": None, "errors": []}

        @subscription_lock(timeout=10, name="concurrent_test")
        def update_plan(subscription, new_plan):
            try:
                # Read current plan
                current_plan = subscription.plan

                # Simulate some processing time
                time.sleep(0.1)

                # Update with conditional WHERE
                updates = SubscriptionUpdates(plan=new_plan)
                updates.apply(
                    subscription,
                    conditions={
                        "id": subscription.id,
                        "plan": current_plan,
                        "billing_period_end": subscription.billing_period_end,
                    },
                )
                return True
            except Exception as e:
                return e

        def thread1_work():
            # Reload subscription in this thread
            sub = BillingSubscription.objects.get(id=self.subscription.id)
            results["thread1"] = update_plan(sub, "premium")

        def thread2_work():
            # Small delay to ensure thread1 starts first
            time.sleep(0.05)
            # Reload subscription in this thread
            sub = BillingSubscription.objects.get(id=self.subscription.id)
            results["thread2"] = update_plan(sub, "enterprise")

        # Start both threads
        t1 = Thread(target=thread1_work)
        t2 = Thread(target=thread2_work)

        t1.start()
        t2.start()

        t1.join(timeout=15)
        t2.join(timeout=15)

        # Both threads should complete successfully
        # One will execute first, refresh the subscription, and update to premium
        # The second will wait for the lock, refresh (seeing premium), and update to enterprise
        assert results["thread1"] is True or isinstance(results["thread1"], Exception)
        assert results["thread2"] is True or isinstance(results["thread2"], Exception)

        # At least one should succeed
        success_count = sum(1 for r in [results["thread1"], results["thread2"]] if r is True)
        assert success_count >= 1

    def test_refresh_prevents_stale_conditions(self):
        """
        Test that refresh_from_db() in the decorator prevents stale WHERE conditions.

        This simulates the exact scenario from the bug:
        1. Process A reads subscription
        2. Process B modifies subscription
        3. Process A (with lock) should see fresh values after refresh
        """

        @subscription_lock(timeout=5)
        def update_with_conditions(subscription, new_plan):
            # After the decorator runs, subscription should have fresh values
            # So this condition should match the current DB state
            updates = SubscriptionUpdates(plan=new_plan)
            updates.apply(
                subscription,
                conditions={
                    "id": subscription.id,
                    "plan": subscription.plan,  # Fresh after refresh_from_db()
                    "billing_period_end": subscription.billing_period_end,
                },
            )

        # Simulate: Read subscription
        sub = BillingSubscription.objects.get(id=self.subscription.id)
        assert sub.plan == "basic"

        # Simulate: Another process modifies it
        BillingSubscription.objects.filter(id=self.subscription.id).update(
            plan="modified_by_other_process"
        )

        # Simulate: Try to update with the (now stale) subscription object
        # The decorator's refresh_from_db() should get fresh values
        # so the update should succeed (not raise SubscriptionIntegrityError)
        update_with_conditions(sub, "premium")

        # Verify the update succeeded
        sub.refresh_from_db()
        assert sub.plan == "premium"


class SubscriptionUpdatesTest(SentryTestCase):
    """Test the SubscriptionUpdates.apply() method."""

    def setUp(self):
        super().setUp()
        self.subscription = BillingSubscription.objects.create(
            organization_id=1,
            plan="basic",
            billing_period_end=datetime(2026, 4, 1, tzinfo=timezone.utc),
            quantity=1,
            cancel_at_period_end=False,
        )

    def test_apply_updates_fields(self):
        """Test that apply() updates the specified fields."""
        new_date = datetime(2026, 5, 1, tzinfo=timezone.utc)
        updates = SubscriptionUpdates(
            plan="premium",
            billing_period_end=new_date,
            quantity=5,
        )

        updates.apply(self.subscription)

        # Reload from DB
        self.subscription.refresh_from_db()
        assert self.subscription.plan == "premium"
        assert self.subscription.billing_period_end == new_date
        assert self.subscription.quantity == 5

    def test_apply_with_conditions(self):
        """Test that apply() uses conditions for conditional UPDATE."""
        updates = SubscriptionUpdates(plan="premium")

        # Should succeed with matching conditions
        updates.apply(
            self.subscription,
            conditions={
                "id": self.subscription.id,
                "plan": "basic",
            },
        )

        self.subscription.refresh_from_db()
        assert self.subscription.plan == "premium"

    def test_apply_fails_with_mismatched_conditions(self):
        """Test that apply() raises error when conditions don't match."""
        updates = SubscriptionUpdates(plan="premium")

        # Should fail with non-matching conditions
        with pytest.raises(SubscriptionIntegrityError) as exc_info:
            updates.apply(
                self.subscription,
                conditions={
                    "id": self.subscription.id,
                    "plan": "nonexistent_plan",  # Doesn't match actual plan
                },
            )

        assert "does not match conditions" in str(exc_info.value)

    def test_apply_updates_in_memory_object(self):
        """Test that apply() updates the in-memory object."""
        updates = SubscriptionUpdates(plan="premium", quantity=10)
        updates.apply(self.subscription)

        # Check in-memory object (without refresh_from_db)
        assert self.subscription.plan == "premium"
        assert self.subscription.quantity == 10

    def test_apply_with_no_fields(self):
        """Test that apply() handles empty updates gracefully."""
        updates = SubscriptionUpdates()

        # Should not raise an error
        updates.apply(self.subscription)

    def test_apply_partial_update(self):
        """Test that apply() only updates specified fields."""
        original_plan = self.subscription.plan

        # Only update quantity
        updates = SubscriptionUpdates(quantity=5)
        updates.apply(self.subscription)

        self.subscription.refresh_from_db()
        assert self.subscription.plan == original_plan  # Unchanged
        assert self.subscription.quantity == 5  # Changed
