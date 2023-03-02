from operator import attrgetter

import pytest

from sentry.dynamic_sampling.models.adjustment_models import AdjustedModel
from sentry.dynamic_sampling.models.adjustment_models import DSProject as P


def test_adjust_sample_rates_org_with_no_projects():
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


def test_adjust_sample_rates_org_with_few_projects_and_zeros():
    target = [
        (1, 13369016.0),
        (11276, 369985.0),
        (37617, 55.0),
        (155735, 126.0),
        (162676, 10550.0),
        (191772, 5.0),
        (239368, 1.0),
        (300688, 2595111.0),
        (1267915, 15199.0),
        (1886021, 445.0),
        (2053674, 47.0),
        (4857230, 26530.0),
        (5246761, 8211.0),
        (5266138, 737.0),
        (5324467, 89.0),
        (5350637, 11.0),
        (5600888, 68.0),
        (5613292, 161.0),
        (5683166, 63.0),
        (5738630, 257.0),
        (5899451, 1417.0),
        (5903949, 10263.0),
        (6178942, 358470.0),
        (6301746, 244.0),
        (6418660, 21.0),
        (6424467, 5055781.0),
        (6690737, 773.0),
        (4504044639748096, 493.0),
        (4504044642107392, 1564.0),
        (4504373448540160, 22.0),
    ]
    projects = [
        P(id=p_id, count_per_root=count_per_root, blended_sample_rate=0.036)
        for p_id, count_per_root in target
    ]
    p = AdjustedModel(projects=projects)

    result = p.adjust_sample_rates()
    for p in result:
        assert 1.0 >= p.new_sample_rate > 0
        assert (p.count_per_root / p.new_count_per_root) * p.new_sample_rate == pytest.approx(
            p.blended_sample_rate
        )


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
