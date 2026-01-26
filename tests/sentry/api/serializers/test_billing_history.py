"""
Tests for Billing History Serializers

Tests the graceful handling of historical billing data with obsolete tier configurations.
Verifies the fix for SENTRY-3B06.
"""
from sentry.api.serializers import serialize
from sentry.api.serializers.billing_history import (
    BillingHistorySerializer,
    BillingMetricHistorySerializer,
    calculate_price_safe,
    get_tier_safe,
)
from sentry.testutils.cases import TestCase


class BillingMetricHistorySerializerTest(TestCase):
    """Tests for BillingMetricHistorySerializer"""

    def test_serialize_basic_metric_history(self):
        """Test serialization of basic billing metric history"""
        metric_history = {
            "category": "errors",
            "free": 5000,
            "on_demand_budget": 0,
            "on_demand_quantity": 0,
            "on_demand_spend_used": 0,
            "order": 1,
            "payg_cpe": None,
            "prepaid": 5000,
            "reserved": 5000,
            "sent_usage_warning": False,
            "soft_cap_type": None,
            "true_forward": False,
            "usage": 2500,
            "usage_exceeded": False,
            "custom_price": None,
            "retention": {"standard": 90, "downsampled": None},
        }

        result = serialize(metric_history, serializer=BillingMetricHistorySerializer())

        assert result["category"] == "errors"
        assert result["free"] == 5000
        assert result["reserved"] == 5000
        assert result["usage"] == 2500
        assert result["usageExceeded"] is False

    def test_serialize_metric_history_with_reserved_spend(self):
        """Test serialization includes reserved spend for budget metrics"""
        metric_history = {
            "category": "transactions",
            "reserved": 10000,
            "usage": 8000,
            "reserved_spend": 1500,  # Historical reserved spend
        }

        result = serialize(metric_history, serializer=BillingMetricHistorySerializer())

        assert result["category"] == "transactions"
        assert result["reserved"] == 10000
        assert result["reservedSpend"] == 1500

    def test_serialize_historical_attachments_tier(self):
        """
        Test serialization of historical attachments tier (1GB).
        
        This tests the fix for SENTRY-3B06 where historical billing records
        contain a reserved quantity of 1GB for attachments, but this tier
        no longer exists in current plan definitions.
        """
        metric_history = {
            "category": "attachments",
            "reserved": 1_000_000_000,  # 1GB - historical tier that no longer exists
            "usage": 500_000_000,  # 500MB used
            "prepaid": 1_000_000_000,
            "free": 0,
        }

        # This should not raise TierNotFound
        result = serialize(metric_history, serializer=BillingMetricHistorySerializer())

        assert result["category"] == "attachments"
        assert result["reserved"] == 1_000_000_000
        assert result["usage"] == 500_000_000


class BillingHistorySerializerTest(TestCase):
    """Tests for BillingHistorySerializer"""

    def test_serialize_billing_history_with_categories(self):
        """Test serialization of complete billing history record"""
        history_record = {
            "id": 12345,
            "is_current": True,
            "period_start": "2024-01-01",
            "period_end": "2024-01-31",
            "plan": "am1_sponsored",
            "plan_name": "Sponsored Team",
            "on_demand_max_spend": 0,
            "on_demand_spend": 0,
            "on_demand_budget_mode": "shared",
            "categories": {
                "errors": {
                    "category": "errors",
                    "reserved": 5000,
                    "usage": 3000,
                },
                "transactions": {
                    "category": "transactions",
                    "reserved": 10000,  # Historical tier
                    "usage": 8000,
                },
                "attachments": {
                    "category": "attachments",
                    "reserved": 1_000_000_000,  # 1GB - obsolete tier
                    "usage": 500_000_000,
                },
            },
            "csv_link": "https://example.com/export.csv",
            "csv_per_project_link": "https://example.com/export-per-project.csv",
            "usage": {
                "errors": 3000,
                "transactions": 8000,
                "attachments": 500_000_000,
            },
            "reserved": {
                "errors": 5000,
                "transactions": 10000,
                "attachments": 1_000_000_000,
            },
            "had_custom_dynamic_sampling": False,
        }

        # This should not raise TierNotFound even though attachment tier doesn't exist
        result = serialize(history_record, serializer=BillingHistorySerializer())

        assert result["id"] == "12345"
        assert result["isCurrent"] is True
        assert result["plan"] == "am1_sponsored"
        assert "categories" in result
        assert "errors" in result["categories"]
        assert "transactions" in result["categories"]
        assert "attachments" in result["categories"]

        # Verify historical attachment tier is preserved
        assert result["categories"]["attachments"]["reserved"] == 1_000_000_000

    def test_serialize_billing_history_with_reserved_budgets(self):
        """Test serialization of billing history with reserved budgets"""
        history_record = {
            "id": 12346,
            "is_current": False,
            "period_start": "2023-12-01",
            "period_end": "2023-12-31",
            "plan": "am2_b",
            "plan_name": "Business",
            "categories": {},
            "reserved_budgets": [
                {
                    "id": "budget_1",
                    "reserved_budget": 50000,
                    "free_budget": 10000,
                    "categories": {
                        "errors": {
                            "category": "errors",
                            "reserved": 100000,
                            "reserved_spend": 4500,
                        }
                    },
                }
            ],
        }

        result = serialize(history_record, serializer=BillingHistorySerializer())

        assert "reservedBudgets" in result
        assert len(result["reservedBudgets"]) == 1
        assert result["reservedBudgets"][0]["id"] == "budget_1"
        assert result["reservedBudgets"][0]["reservedBudget"] == 50000
        assert "errors" in result["reservedBudgets"][0]["categories"]


class GetTierSafeTest(TestCase):
    """Tests for get_tier_safe function"""

    def test_get_tier_safe_finds_matching_tier(self):
        """Test get_tier_safe returns tier when it exists"""
        plan = {
            "categories": {
                "errors": {
                    "tiers": [
                        {"quantity": 5000, "price": 0},
                        {"quantity": 50000, "price": 100},
                        {"quantity": 500000, "price": 500},
                    ]
                }
            }
        }

        tier = get_tier_safe(plan, "errors", 50000)

        assert tier is not None
        assert tier["quantity"] == 50000
        assert tier["price"] == 100

    def test_get_tier_safe_returns_none_for_missing_tier(self):
        """
        Test get_tier_safe returns None for historical tier that no longer exists.
        
        This is the core fix for SENTRY-3B06.
        """
        plan = {
            "categories": {
                "attachments": {
                    "tiers": [
                        # Current plan only has 100GB tier, not 1GB
                        {"quantity": 100_000_000_000, "price": 500},
                    ]
                }
            }
        }

        # Try to find historical 1GB tier
        tier = get_tier_safe(plan, "attachments", 1_000_000_000)

        # Should return None instead of raising TierNotFound
        assert tier is None

    def test_get_tier_safe_handles_missing_category(self):
        """Test get_tier_safe returns None when category doesn't exist in plan"""
        plan = {
            "categories": {
                "errors": {
                    "tiers": [{"quantity": 5000, "price": 0}]
                }
            }
        }

        tier = get_tier_safe(plan, "nonexistent_category", 5000)

        assert tier is None

    def test_get_tier_safe_handles_none_plan(self):
        """Test get_tier_safe handles None plan gracefully"""
        tier = get_tier_safe(None, "errors", 5000)

        assert tier is None

    def test_get_tier_safe_handles_malformed_plan(self):
        """Test get_tier_safe handles malformed plan data"""
        plan = {"invalid": "structure"}

        tier = get_tier_safe(plan, "errors", 5000)

        assert tier is None


class CalculatePriceSafeTest(TestCase):
    """Tests for calculate_price_safe function"""

    def test_calculate_price_safe_with_valid_tier(self):
        """Test price calculation when tier exists"""
        plan = {
            "categories": {
                "errors": {
                    "tiers": [
                        {"quantity": 5000, "price": 100, "overage_price": 0.01},
                    ]
                }
            }
        }

        # Usage within tier
        price = calculate_price_safe(plan, "errors", 5000, 3000)
        assert price == 100

        # Usage exceeds tier
        price = calculate_price_safe(plan, "errors", 5000, 6000)
        assert price == 100 + (1000 * 0.01)

    def test_calculate_price_safe_with_missing_tier(self):
        """
        Test price calculation returns 0 for historical tier.
        
        When tier doesn't exist in current plan (historical data),
        we return 0 as the price must come from historical records.
        """
        plan = {
            "categories": {
                "attachments": {
                    "tiers": [
                        {"quantity": 100_000_000_000, "price": 500},
                    ]
                }
            }
        }

        # Try to calculate price for historical 1GB tier
        price = calculate_price_safe(plan, "attachments", 1_000_000_000, 500_000_000)

        # Should return 0 instead of raising error
        assert price == 0

    def test_calculate_price_safe_handles_none_plan(self):
        """Test price calculation with None plan"""
        price = calculate_price_safe(None, "errors", 5000, 3000)

        assert price == 0
