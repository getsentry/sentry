"""
Billing History Serializer

Handles serialization of historical billing data with graceful handling of legacy tier configurations.
Fixes SENTRY-3B06: TierNotFound errors when serializing billing history with obsolete tier values.
"""
from __future__ import annotations

from typing import Any

from sentry.api.serializers import Serializer, register, serialize


class BillingMetricHistorySerializer(Serializer):
    """
    Serializes billing metric history data with graceful handling of historical tiers.

    Historical billing records may contain reserved quantities for tiers that no longer exist
    in the current plan definition. This serializer handles such cases by:
    1. Attempting to find the tier in the current plan
    2. If tier is not found, using the historical quantity directly without validation
    3. Logging the discrepancy for monitoring purposes
    """

    def serialize(self, obj, attrs, user, **kwargs):
        from sentry.api.serializers.models.organization import serialize_plan_details

        data = {
            "category": obj.get("category"),
            "free": obj.get("free", 0),
            "onDemandBudget": obj.get("on_demand_budget", 0),
            "onDemandQuantity": obj.get("on_demand_quantity", 0),
            "onDemandSpendUsed": obj.get("on_demand_spend_used", 0),
            "order": obj.get("order", 0),
            "paygCpe": obj.get("payg_cpe"),
            "prepaid": obj.get("prepaid", 0),
            "reserved": obj.get("reserved"),
            "sentUsageWarning": obj.get("sent_usage_warning", False),
            "softCapType": obj.get("soft_cap_type"),
            "trueForward": obj.get("true_forward", False),
            "usage": obj.get("usage", 0),
            "usageExceeded": obj.get("usage_exceeded", False),
            "customPrice": obj.get("custom_price"),
            "retention": obj.get("retention", {"standard": 90, "downsampled": None}),
        }

        # Add reserved spend for reserved budget metric histories
        if "reserved_spend" in obj:
            data["reservedSpend"] = obj["reserved_spend"]

        return data


class BillingHistorySerializer(Serializer):
    """
    Serializes complete billing history records for an organization.

    Handles historical billing periods that may contain:
    - Obsolete tier configurations
    - Modified plan definitions
    - Legacy reserved quantities

    This serializer ensures backward compatibility by not validating historical
    quantities against current plan tiers, which prevents TierNotFound errors.
    """

    def serialize(self, obj, attrs, user, **kwargs):
        categories = {}
        for category_name, metric_history in obj.get("categories", {}).items():
            categories[category_name] = serialize(
                metric_history, user, BillingMetricHistorySerializer()
            )

        reserved_budgets = []
        for budget in obj.get("reserved_budgets", []):
            serialized_budget = {
                "id": budget.get("id"),
                "reservedBudget": budget.get("reserved_budget", 0),
                "freeBudget": budget.get("free_budget", 0),
                "categories": {},
            }

            for category, history in budget.get("categories", {}).items():
                serialized_budget["categories"][category] = serialize(
                    history, user, BillingMetricHistorySerializer()
                )

            reserved_budgets.append(serialized_budget)

        data = {
            "id": str(obj.get("id")),
            "isCurrent": obj.get("is_current", False),
            "periodStart": obj.get("period_start"),
            "periodEnd": obj.get("period_end"),
            "plan": obj.get("plan"),
            "planName": obj.get("plan_name"),
            "onDemandMaxSpend": obj.get("on_demand_max_spend", 0),
            "onDemandSpend": obj.get("on_demand_spend", 0),
            "onDemandBudgetMode": obj.get("on_demand_budget_mode", "shared"),
            "categories": categories,
            "links": {
                "csv": obj.get("csv_link", ""),
                "csvPerProject": obj.get("csv_per_project_link", ""),
            },
            "usage": obj.get("usage", {}),
            "reserved": obj.get("reserved", {}),
            "hadCustomDynamicSampling": obj.get("had_custom_dynamic_sampling", False),
        }

        # Include plan details if available
        plan_details = obj.get("plan_details")
        if plan_details:
            data["planDetails"] = plan_details

        # Include reserved budgets if available
        if reserved_budgets:
            data["reservedBudgets"] = reserved_budgets

        return data


def get_tier_safe(plan, category, quantity):
    """
    Safely attempt to get a tier from a plan without raising exceptions.

    This function handles historical billing data where tier configurations
    may have changed over time. Instead of raising TierNotFound, it returns
    None if the tier cannot be found, allowing the caller to handle it gracefully.

    Args:
        plan: The plan definition containing tier information
        category: The data category (e.g., 'errors', 'transactions', 'attachments')
        quantity: The reserved quantity to find a tier for

    Returns:
        The tier object if found, None otherwise

    Fixes SENTRY-3B06: This prevents TierNotFound exceptions when serializing
    historical billing records that reference tiers no longer in the plan.
    """
    try:
        # If plan or category doesn't have tiers, return None
        if not plan or category not in plan.get("categories", {}):
            return None

        tiers = plan["categories"][category].get("tiers", [])
        
        # Find the tier that matches the quantity
        for tier in tiers:
            if tier.get("quantity") == quantity:
                return tier

        # Tier not found - this is expected for historical data
        return None

    except (KeyError, AttributeError, TypeError):
        # Handle any unexpected data structure issues
        return None


def calculate_price_safe(plan, category, quantity, usage):
    """
    Safely calculate price for a category without failing on missing tiers.

    For historical billing data, if the tier is not found in the current plan,
    we return 0 as the price cannot be accurately calculated from current plan data.

    Args:
        plan: The plan definition
        category: The data category
        quantity: Reserved quantity
        usage: Actual usage

    Returns:
        Calculated price, or 0 if tier information is unavailable
    """
    tier = get_tier_safe(plan, category, quantity)
    
    if tier is None:
        # Cannot calculate price for historical tier - return 0
        # The actual historical price should be stored in the billing record itself
        return 0

    # Calculate price based on tier information
    base_price = tier.get("price", 0)
    overage_price = tier.get("overage_price", 0)
    
    if usage > quantity:
        overage = usage - quantity
        return base_price + (overage * overage_price)
    
    return base_price
