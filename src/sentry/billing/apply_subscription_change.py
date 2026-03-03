"""
Apply subscription changes with proper locking to prevent race conditions.

This module demonstrates the correct usage of @subscription_lock decorator
to prevent concurrent modification issues when updating subscriptions.
"""

from __future__ import annotations

import logging
from datetime import datetime

from sentry.billing.models import BillingSubscription
from sentry.billing.staged import SubscriptionUpdates
from sentry.billing.subscription_lock import subscription_lock

logger = logging.getLogger(__name__)


@subscription_lock(timeout=10, name="apply_subscription_change")
def apply_subscription_change(
    subscription: BillingSubscription,
    new_plan: str,
    new_billing_period_end: datetime,
) -> None:
    """
    Apply a plan change to a subscription.

    This function is decorated with @subscription_lock which:
    1. Acquires a lock on the subscription
    2. Calls refresh_from_db() to get fresh values
    3. Clears cached options
    4. Executes this function with the lock held

    After the decorator runs, the subscription object is guaranteed to have
    fresh database values, so the conditions passed to SubscriptionUpdates.apply()
    will match the current database state.

    Args:
        subscription: The subscription to update (will have fresh DB values
                     after @subscription_lock runs)
        new_plan: The new plan to apply
        new_billing_period_end: The new billing period end date
    """
    logger.info(
        "Applying subscription change",
        extra={
            "subscription_id": subscription.id,
            "old_plan": subscription.plan,  # Fresh value after refresh_from_db()
            "new_plan": new_plan,
            "old_billing_period_end": subscription.billing_period_end,  # Fresh value
            "new_billing_period_end": new_billing_period_end,
        },
    )

    # Create the updates to apply
    updates = SubscriptionUpdates(
        plan=new_plan,
        billing_period_end=new_billing_period_end,
    )

    # Apply the updates with conditions
    # The subscription object has fresh values thanks to @subscription_lock calling
    # refresh_from_db(), so these conditions will match the current database state
    updates.apply(
        subscription,
        conditions={
            "id": subscription.id,
            "plan": subscription.plan,  # Fresh value from refresh_from_db()
            "billing_period_end": subscription.billing_period_end,  # Fresh value
        },
    )

    logger.info(
        "Successfully applied subscription change",
        extra={
            "subscription_id": subscription.id,
            "new_plan": subscription.plan,
            "new_billing_period_end": subscription.billing_period_end,
        },
    )


@subscription_lock(timeout=10, name="update_subscription_quantity")
def update_subscription_quantity(
    subscription: BillingSubscription,
    new_quantity: int,
) -> None:
    """
    Update the quantity on a subscription.

    The @subscription_lock decorator ensures subscription has fresh DB values.

    Args:
        subscription: The subscription to update (fresh values after lock acquisition)
        new_quantity: The new quantity
    """
    logger.info(
        "Updating subscription quantity",
        extra={
            "subscription_id": subscription.id,
            "old_quantity": subscription.quantity,
            "new_quantity": new_quantity,
        },
    )

    updates = SubscriptionUpdates(quantity=new_quantity)

    # Conditions use fresh values from refresh_from_db() called by @subscription_lock
    updates.apply(
        subscription,
        conditions={
            "id": subscription.id,
            "plan": subscription.plan,
            "billing_period_end": subscription.billing_period_end,
        },
    )

    logger.info(
        "Successfully updated subscription quantity",
        extra={
            "subscription_id": subscription.id,
            "quantity": subscription.quantity,
        },
    )
