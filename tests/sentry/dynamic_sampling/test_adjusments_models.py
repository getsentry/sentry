from operator import attrgetter

import pytest

from sentry.dynamic_sampling.models.adjustment_models import AdjustedModel
from sentry.dynamic_sampling.models.adjustment_models import DSProject as P


def test_adjust_sample_rates_org_wo_projects():
    p = AdjustedModel(projects=[])
    assert p.adjust_sample_rates() == []


def test_adjust_sample_rates_org_with_single_project():
    p = AdjustedModel(projects=[P(id=1, count_per_root=10, blended_sample_rate=0.4)])
    assert p.adjust_sample_rates() == [
        P(id=1, count_per_root=10, blended_sample_rate=0.4, new_sample_rate=0.4)
    ]


def test_adjust_sample_rates_org_with_few_projects():
    projects = [
        P(id=1, count_per_root=9.0, blended_sample_rate=0.25),
        P(id=2, count_per_root=7.0, blended_sample_rate=0.25),
        P(id=3, count_per_root=3.0, blended_sample_rate=0.25),
        P(id=4, count_per_root=1.0, blended_sample_rate=0.25),
    ]
    p = AdjustedModel(projects=projects)

    expected_projects = [
        P(
            id=1,
            count_per_root=9.0,
            new_count_per_root=6.0,
            blended_sample_rate=0.25,
            new_sample_rate=pytest.approx(0.16666666666666666),
        ),
        P(
            id=2,
            count_per_root=7.0,
            new_count_per_root=5.5,
            blended_sample_rate=0.25,
            new_sample_rate=pytest.approx(0.19642857142857142),
        ),
        P(
            id=3,
            count_per_root=3.0,
            new_count_per_root=4.5,
            blended_sample_rate=0.25,
            new_sample_rate=0.375,
        ),
        P(
            id=4,
            count_per_root=1.0,
            new_count_per_root=4.0,
            blended_sample_rate=0.25,
            new_sample_rate=1.0,
        ),
    ]

    assert p.adjust_sample_rates() == expected_projects


def test_adjust_sample_rates_org_with_even_num_projects():
    projects = [
        P(id=1, count_per_root=8.0, blended_sample_rate=0.25),
        P(id=2, count_per_root=7.0, blended_sample_rate=0.25),
        P(id=3, count_per_root=3.0, blended_sample_rate=0.25),
    ]
    p = AdjustedModel(projects=projects)

    expected_projects = [
        P(
            id=1,
            count_per_root=8.0,
            new_count_per_root=5.0,
            blended_sample_rate=0.25,
            new_sample_rate=0.15625,
        ),
        P(
            id=2,
            count_per_root=7.0,
            new_count_per_root=7.0,
            blended_sample_rate=0.25,
            new_sample_rate=0.0,
        ),
        P(
            id=3,
            count_per_root=3.0,
            new_count_per_root=6.0,
            blended_sample_rate=0.25,
            new_sample_rate=0.5,
        ),
    ]

    assert p.adjust_sample_rates() == expected_projects


def test_adjust_sample_rates_org_with_same_counts_projects():
    projects = [
        P(id=1, count_per_root=9.0, blended_sample_rate=0.25),
        P(id=2, count_per_root=6.0, blended_sample_rate=0.25),
        P(id=3, count_per_root=6.0, blended_sample_rate=0.25),
        P(id=4, count_per_root=1.0, blended_sample_rate=0.25),
    ]
    p = AdjustedModel(projects=projects)

    expected_projects = [
        P(
            id=1,
            count_per_root=9.0,
            new_count_per_root=6.0,
            blended_sample_rate=0.25,
            new_sample_rate=pytest.approx(0.16666666666666666),
        ),
        P(
            id=2,
            count_per_root=6.0,
            new_count_per_root=6.375,
            blended_sample_rate=0.25,
            new_sample_rate=0.265625,
        ),
        P(
            id=3,
            count_per_root=6.0,
            new_count_per_root=5.625,
            blended_sample_rate=0.25,
            new_sample_rate=0.234375,
        ),
        P(
            id=4,
            count_per_root=1.0,
            new_count_per_root=4.0,
            blended_sample_rate=0.25,
            new_sample_rate=1.0,
        ),
    ]

    assert p.adjust_sample_rates() == expected_projects


def test_adjust_sample_rates_org_with_counts_projects():
    projects = [
        P(id=1, count_per_root=2.0, blended_sample_rate=0.25),
        P(id=2, count_per_root=10.0, blended_sample_rate=0.25),
        P(id=3, count_per_root=10.0, blended_sample_rate=0.25),
        P(id=4, count_per_root=10.0, blended_sample_rate=0.25),
    ]
    p = AdjustedModel(projects=projects)

    expected_projects = [
        P(
            id=1,
            count_per_root=2.0,
            new_count_per_root=8.0,
            blended_sample_rate=0.25,
            new_sample_rate=1.0,
        ),
        P(
            id=2,
            count_per_root=10.0,
            new_count_per_root=4.0,
            blended_sample_rate=0.25,
            new_sample_rate=0.1,
        ),
        P(
            id=3,
            count_per_root=10.0,
            new_count_per_root=11.5,
            blended_sample_rate=0.25,
            new_sample_rate=0.2875,
        ),
        P(
            id=4,
            count_per_root=10.0,
            new_count_per_root=8.5,
            blended_sample_rate=0.25,
            new_sample_rate=0.2125,
        ),
    ]

    assert sorted(p.adjust_sample_rates(), key=attrgetter("id")) == expected_projects
