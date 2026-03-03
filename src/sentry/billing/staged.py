"""
Staged subscription updates with conditional UPDATE logic.

This module provides the SubscriptionUpdates class which applies changes to subscriptions
using conditional UPDATEs to prevent lost updates in concurrent modification scenarios.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from django.db import models

from sentry.billing.subscription_lock import SubscriptionIntegrityError

logger = logging.getLogger(__name__)


@dataclass
class SubscriptionUpdates:
    """
    Represents a set of updates to apply to a subscription using conditional UPDATE.

    This class ensures that updates are only applied if the subscription is in the
    expected state, preventing lost updates due to concurrent modifications.

    When using the @subscription_lock decorator, the subscription object passed to
    apply() is guaranteed to have fresh database values, ensuring the conditions
    match the current state.
    """

    plan: str | None = None
    billing_period_end: datetime | None = None
    cancel_at_period_end: bool | None = None
    quantity: int | None = None

    def apply(
        self,
        subscription: models.Model,
        conditions: dict[str, Any] | None = None,
    ) -> None:
        """
        Apply the updates to the subscription using a conditional UPDATE.

        This method uses Django's update() with conditions to ensure the subscription
        is only modified if it matches the expected state. This prevents the
        "lost update" problem in concurrent modification scenarios.

        IMPORTANT: When calling this method, the `conditions` parameter should reflect
        the current subscription state. The @subscription_lock decorator automatically
        ensures this by calling refresh_from_db() immediately after acquiring the lock,
        so the subscription object will have fresh values.

        Args:
            subscription: The subscription model instance to update
            conditions: Additional WHERE clause conditions for the UPDATE.
                       If None, defaults to using subscription's id, plan, and
                       billing_period_end as conditions.

        Raises:
            SubscriptionIntegrityError: If the conditional UPDATE affects 0 rows,
                                       indicating the subscription was modified
                                       concurrently.

        Example:
            @subscription_lock()
            def update_subscription_plan(subscription, new_plan):
                # After lock acquisition, subscription has fresh DB values
                updates = SubscriptionUpdates(plan=new_plan)

                # Conditions automatically match current state thanks to refresh_from_db()
                # called by @subscription_lock
                updates.apply(
                    subscription,
                    conditions={
                        'id': subscription.id,
                        'plan': subscription.plan,  # Fresh value from DB
                        'billing_period_end': subscription.billing_period_end,  # Fresh value
                    }
                )
        """
        if conditions is None:
            # Default conditions: id, plan, and billing_period_end
            # These values are fresh because @subscription_lock calls refresh_from_db()
            conditions = {
                "id": subscription.id,
                "plan": subscription.plan,
                "billing_period_end": subscription.billing_period_end,
            }

        # Build the update fields
        update_fields: dict[str, Any] = {}
        if self.plan is not None:
            update_fields["plan"] = self.plan
        if self.billing_period_end is not None:
            update_fields["billing_period_end"] = self.billing_period_end
        if self.cancel_at_period_end is not None:
            update_fields["cancel_at_period_end"] = self.cancel_at_period_end
        if self.quantity is not None:
            update_fields["quantity"] = self.quantity

        if not update_fields:
            logger.debug("No fields to update for subscription %s", subscription.id)
            return

        # Perform conditional UPDATE
        # This uses UPDATE ... WHERE id=X AND plan=Y AND billing_period_end=Z
        # to ensure we only update if the subscription hasn't changed
        queryset = subscription.__class__.objects.filter(**conditions)
        affected_rows = queryset.update(**update_fields)

        if affected_rows == 0:
            # The WHERE conditions didn't match any rows, meaning the subscription
            # was modified between when we read it (even after the lock!) and now.
            # This should be very rare if @subscription_lock is used correctly.
            logger.error(
                "Conditional UPDATE failed for subscription",
                extra={
                    "subscription_id": subscription.id,
                    "conditions": conditions,
                    "update_fields": update_fields,
                },
            )
            raise SubscriptionIntegrityError(
                f"Failed to update subscription {subscription.id}: "
                f"row does not match conditions {conditions}"
            )

        if affected_rows > 1:
            # This should never happen if id is in the conditions
            logger.error(
                "Conditional UPDATE affected multiple rows",
                extra={
                    "subscription_id": subscription.id,
                    "affected_rows": affected_rows,
                    "conditions": conditions,
                },
            )
            raise SubscriptionIntegrityError(f"UPDATE affected {affected_rows} rows, expected 1")

        # Update the in-memory object to reflect the changes
        for field, value in update_fields.items():
            setattr(subscription, field, value)

        logger.info(
            "Successfully applied subscription updates",
            extra={
                "subscription_id": subscription.id,
                "update_fields": list(update_fields.keys()),
            },
        )
