"""
Billing subscription models.

This module provides example subscription models that demonstrate the proper use
of the subscription_lock decorator and conditional UPDATE patterns.
"""

from __future__ import annotations

from django.db import models


class BillingSubscription(models.Model):
    """
    Example subscription model demonstrating the subscription integrity fix.

    This model represents a billing subscription and is used to demonstrate
    how the @subscription_lock decorator prevents race conditions in concurrent
    subscription modifications.
    """

    class Meta:
        app_label = "billing"
        db_table = "billing_subscription"
        indexes = [
            models.Index(fields=["organization_id"]),
            models.Index(fields=["plan", "billing_period_end"]),
        ]

    # Primary key
    id = models.BigAutoField(primary_key=True)

    # Foreign key to organization
    organization_id = models.BigIntegerField(db_index=True)

    # Subscription details
    plan = models.CharField(max_length=100)
    billing_period_end = models.DateTimeField()
    cancel_at_period_end = models.BooleanField(default=False)
    quantity = models.IntegerField(default=1)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Stripe subscription ID
    stripe_subscription_id = models.CharField(max_length=255, unique=True, null=True)

    def __str__(self) -> str:
        return f"Subscription {self.id} (plan={self.plan}, org={self.organization_id})"

    def __repr__(self) -> str:
        return (
            f"<BillingSubscription id={self.id} plan={self.plan} "
            f"billing_period_end={self.billing_period_end}>"
        )
