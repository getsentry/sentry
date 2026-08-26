from __future__ import annotations

from sentry.dynamic_sampling.per_org.gate import is_recalibration_served_by_per_org
from sentry.testutils.helpers.options import override_options

ORG_ID = 1234
_OPTIONS = {
    "dynamic-sampling.per_org.killswitch": False,
    "dynamic-sampling.per_org.recalibration-serving-org-ids": [],
    "dynamic-sampling.per_org.recalibration-serving-rollout-rate": 0.0,
}


@override_options(_OPTIONS)
def test_recalibration_is_served_by_legacy_by_default() -> None:
    assert is_recalibration_served_by_per_org(ORG_ID) is False


@override_options(
    {**_OPTIONS, "dynamic-sampling.per_org.recalibration-serving-org-ids": [ORG_ID, "99"]}
)
def test_recalibration_is_served_by_per_org_for_listed_orgs() -> None:
    assert is_recalibration_served_by_per_org(ORG_ID) is True
    assert is_recalibration_served_by_per_org(99) is True
    assert is_recalibration_served_by_per_org(5678) is False


@override_options({**_OPTIONS, "dynamic-sampling.per_org.recalibration-serving-rollout-rate": 1.0})
def test_recalibration_is_served_by_per_org_inside_the_rollout() -> None:
    assert is_recalibration_served_by_per_org(ORG_ID) is True


@override_options(
    {
        **_OPTIONS,
        "dynamic-sampling.per_org.recalibration-serving-org-ids": [ORG_ID],
        "dynamic-sampling.per_org.recalibration-serving-rollout-rate": 1.0,
        "dynamic-sampling.per_org.killswitch": True,
    }
)
def test_killswitch_hands_every_org_back_to_legacy() -> None:
    # The killswitch stops the per-org pipeline, so its factor stops being updated and
    # serving must not keep applying it.
    assert is_recalibration_served_by_per_org(ORG_ID) is False
