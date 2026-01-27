"""Test adaptive sampling for get_tag_value_paginator_for_projects."""
from datetime import datetime, timedelta, timezone
from unittest import mock

import pytest

from sentry.tagstore.snuba.backend import SnubaTagStorage
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.utils.snuba import Dataset


class AdaptiveSamplingTest(TestCase, SnubaTestCase):
    """Test that sample size adapts based on time range to prevent timeouts."""

    def setUp(self):
        super().setUp()
        self.ts = SnubaTagStorage()
        self.proj = self.create_project()

    def test_adaptive_sampling_short_range(self):
        """Test that short time ranges (<=7 days) use full 1M sample."""
        start = datetime.now(timezone.utc) - timedelta(days=5)
        end = datetime.now(timezone.utc)

        with mock.patch("sentry.utils.snuba.query") as mock_query:
            mock_query.return_value = {}
            
            self.ts.get_tag_value_paginator_for_projects(
                projects=[self.proj.id],
                environments=None,
                key="foo",
                start=start,
                end=end,
                dataset=Dataset.Events,
                tenant_ids={"organization_id": 123, "referrer": "test"},
            )

            # Verify sample size is 1M for short range
            assert mock_query.called
            call_kwargs = mock_query.call_args[1]
            assert call_kwargs["sample"] == 1_000_000

    def test_adaptive_sampling_medium_range(self):
        """Test that medium time ranges (<=30 days) use 500K sample."""
        start = datetime.now(timezone.utc) - timedelta(days=20)
        end = datetime.now(timezone.utc)

        with mock.patch("sentry.utils.snuba.query") as mock_query:
            mock_query.return_value = {}
            
            self.ts.get_tag_value_paginator_for_projects(
                projects=[self.proj.id],
                environments=None,
                key="foo",
                start=start,
                end=end,
                dataset=Dataset.Events,
                tenant_ids={"organization_id": 123, "referrer": "test"},
            )

            # Verify sample size is 500K for medium range
            assert mock_query.called
            call_kwargs = mock_query.call_args[1]
            assert call_kwargs["sample"] == 500_000

    def test_adaptive_sampling_long_range(self):
        """Test that long time ranges (<=90 days) use 250K sample."""
        start = datetime.now(timezone.utc) - timedelta(days=60)
        end = datetime.now(timezone.utc)

        with mock.patch("sentry.utils.snuba.query") as mock_query:
            mock_query.return_value = {}
            
            self.ts.get_tag_value_paginator_for_projects(
                projects=[self.proj.id],
                environments=None,
                key="foo",
                start=start,
                end=end,
                dataset=Dataset.Events,
                tenant_ids={"organization_id": 123, "referrer": "test"},
            )

            # Verify sample size is 250K for long range
            assert mock_query.called
            call_kwargs = mock_query.call_args[1]
            assert call_kwargs["sample"] == 250_000

    def test_adaptive_sampling_very_long_range(self):
        """Test that very long time ranges (>90 days) use 100K sample."""
        start = datetime.now(timezone.utc) - timedelta(days=120)
        end = datetime.now(timezone.utc)

        with mock.patch("sentry.utils.snuba.query") as mock_query:
            mock_query.return_value = {}
            
            self.ts.get_tag_value_paginator_for_projects(
                projects=[self.proj.id],
                environments=None,
                key="foo",
                start=start,
                end=end,
                dataset=Dataset.Events,
                tenant_ids={"organization_id": 123, "referrer": "test"},
            )

            # Verify sample size is 100K for very long range
            assert mock_query.called
            call_kwargs = mock_query.call_args[1]
            assert call_kwargs["sample"] == 100_000

    def test_adaptive_sampling_edge_case_7_days(self):
        """Test boundary at exactly 7 days."""
        start = datetime.now(timezone.utc) - timedelta(days=7)
        end = datetime.now(timezone.utc)

        with mock.patch("sentry.utils.snuba.query") as mock_query:
            mock_query.return_value = {}
            
            self.ts.get_tag_value_paginator_for_projects(
                projects=[self.proj.id],
                environments=None,
                key="foo",
                start=start,
                end=end,
                dataset=Dataset.Events,
                tenant_ids={"organization_id": 123, "referrer": "test"},
            )

            # At exactly 7 days, should use 1M
            assert mock_query.called
            call_kwargs = mock_query.call_args[1]
            assert call_kwargs["sample"] == 1_000_000

    def test_adaptive_sampling_edge_case_30_days(self):
        """Test boundary at exactly 30 days."""
        start = datetime.now(timezone.utc) - timedelta(days=30)
        end = datetime.now(timezone.utc)

        with mock.patch("sentry.utils.snuba.query") as mock_query:
            mock_query.return_value = {}
            
            self.ts.get_tag_value_paginator_for_projects(
                projects=[self.proj.id],
                environments=None,
                key="foo",
                start=start,
                end=end,
                dataset=Dataset.Events,
                tenant_ids={"organization_id": 123, "referrer": "test"},
            )

            # At exactly 30 days, should use 500K
            assert mock_query.called
            call_kwargs = mock_query.call_args[1]
            assert call_kwargs["sample"] == 500_000

    def test_adaptive_sampling_edge_case_90_days(self):
        """Test boundary at exactly 90 days."""
        start = datetime.now(timezone.utc) - timedelta(days=90)
        end = datetime.now(timezone.utc)

        with mock.patch("sentry.utils.snuba.query") as mock_query:
            mock_query.return_value = {}
            
            self.ts.get_tag_value_paginator_for_projects(
                projects=[self.proj.id],
                environments=None,
                key="foo",
                start=start,
                end=end,
                dataset=Dataset.Events,
                tenant_ids={"organization_id": 123, "referrer": "test"},
            )

            # At exactly 90 days, should use 250K
            assert mock_query.called
            call_kwargs = mock_query.call_args[1]
            assert call_kwargs["sample"] == 250_000
