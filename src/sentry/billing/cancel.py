"""
Cancel subscription operations with proper locking.

This module demonstrates the correct usage of @subscription_lock decorator
for cancellation operations.
"""

from __future__ import annotations

import logging

from sentry.billing.models import BillingSubscription
from sentry.billing.staged import SubscriptionUpdates
from sentry.billing.subscription_lock import subscription_lock

logger = logging.getLogger(__name__)


@subscription_lock(timeout=10, name="cancel_subscription")
def cancel_subscription_at_period_end(subscription: BillingSubscription) -> None:
    """
    Mark a subscription to be cancelled at the end of the billing period.

    The @subscription_lock decorator ensures:
    1. A lock is acquired on the subscription
    2. refresh_from_db() is called to get fresh values
    3. Any cached options are cleared
    4. This function executes with the lock held and fresh data

    Args:
        subscription: The subscription to cancel (will have fresh DB values
                     after @subscription_lock runs)
    """
    if subscription.cancel_at_period_end:
        logger.info(
            "Subscription already marked for cancellation",
            extra={"subscription_id": subscription.id},
        )
        return

    logger.info(
        "Marking subscription for cancellation at period end",
        extra={
            "subscription_id": subscription.id,
            "billing_period_end": subscription.billing_period_end,
            "plan": subscription.plan,
        },
    )

    # Create the updates to apply
    updates = SubscriptionUpdates(cancel_at_period_end=True)

    # Apply the updates with conditions
    # Thanks to @subscription_lock calling refresh_from_db(), these values are fresh
    updates.apply(
        subscription,
        conditions={
            "id": subscription.id,
            "plan": subscription.plan,  # Fresh from refresh_from_db()
            "billing_period_end": subscription.billing_period_end,  # Fresh
            "cancel_at_period_end": False,  # Ensure not already cancelled
        },
    )

    logger.info(
        "Successfully marked subscription for cancellation",
        extra={"subscription_id": subscription.id},
    )


@subscription_lock(timeout=10, name="reactivate_subscription")
def reactivate_subscription(subscription: BillingSubscription) -> None:
    """
    Reactivate a subscription that was marked for cancellation.

    The @subscription_lock decorator ensures subscription has fresh DB values.

    Args:
        subscription: The subscription to reactivate
    """
    if not subscription.cancel_at_period_end:
        logger.info(
            "Subscription not marked for cancellation",
            extra={"subscription_id": subscription.id},
        )
        return

    logger.info(
        "Reactivating subscription",
        extra={
            "subscription_id": subscription.id,
            "plan": subscription.plan,
        },
    )

    updates = SubscriptionUpdates(cancel_at_period_end=False)

    # Conditions use fresh values from @subscription_lock's refresh_from_db()
    updates.apply(
        subscription,
        conditions={
            "id": subscription.id,
            "plan": subscription.plan,
            "billing_period_end": subscription.billing_period_end,
            "cancel_at_period_end": True,  # Ensure currently marked for cancellation
        },
    )

    logger.info(
        "Successfully reactivated subscription",
        extra={"subscription_id": subscription.id},
    )
