from __future__ import annotations

import pytest

from sentry.dynamic_sampling.per_org.gate import (
    is_org_in_rollout,
    is_org_in_serving_rollout,
    is_rollout_enabled,
)
from sentry.testutils.helpers.options import override_options

ORG_ID = 4711
OTHER_ORG_ID = 4712


@pytest.mark.django_db
class TestRolloutOrgIds:
    """The org-id lists pilot one organization before its rate group exists."""

    @override_options(
        {
            "dynamic-sampling.per_org.rollout-rate": 0.0,
            "dynamic-sampling.per_org.rollout-org-ids": [ORG_ID],
        }
    )
    def test_a_listed_org_is_in_the_rollout_at_a_rate_of_zero(self) -> None:
        assert is_org_in_rollout(ORG_ID)
        assert not is_org_in_rollout(OTHER_ORG_ID)

    @override_options(
        {
            "dynamic-sampling.per_org.rollout-rate": 0.0,
            "dynamic-sampling.per_org.rollout-org-ids": [str(ORG_ID)],
        }
    )
    def test_an_org_id_is_read_as_a_string_too(self) -> None:
        assert is_org_in_rollout(ORG_ID)

    @override_options(
        {
            "dynamic-sampling.per_org.rollout-rate": 1.0,
            "dynamic-sampling.per_org.rollout-org-ids": [ORG_ID],
        }
    )
    def test_the_list_only_adds_to_the_rate_group(self) -> None:
        assert is_org_in_rollout(ORG_ID)
        assert is_org_in_rollout(OTHER_ORG_ID)

    @override_options(
        {
            "dynamic-sampling.per_org.rollout-rate": 0.0,
            "dynamic-sampling.per_org.rollout-org-ids": [],
        }
    )
    def test_the_pipeline_is_disabled_without_a_rate_or_a_list(self) -> None:
        assert not is_rollout_enabled()

    @override_options(
        {
            "dynamic-sampling.per_org.rollout-rate": 0.0,
            "dynamic-sampling.per_org.rollout-org-ids": [ORG_ID],
        }
    )
    def test_a_listed_org_keeps_the_pipeline_running_at_a_rate_of_zero(self) -> None:
        assert is_rollout_enabled()


@pytest.mark.django_db
class TestServingOrgIds:
    @override_options(
        {
            "dynamic-sampling.per_org.serving-rollout-rate": 0.0,
            "dynamic-sampling.per_org.serving-org-ids": [ORG_ID],
        }
    )
    def test_a_listed_org_serves_from_the_per_org_caches(self) -> None:
        assert is_org_in_serving_rollout(ORG_ID)
        assert not is_org_in_serving_rollout(OTHER_ORG_ID)

    @override_options(
        {
            "dynamic-sampling.per_org.killswitch": True,
            "dynamic-sampling.per_org.serving-org-ids": [ORG_ID],
        }
    )
    def test_the_killswitch_overrides_the_list(self) -> None:
        assert not is_org_in_serving_rollout(ORG_ID)
