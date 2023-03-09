from operator import attrgetter

import pytest

from sentry.dynamic_sampling.models.adjustment_models import AdjustedModel
from sentry.dynamic_sampling.models.adjustment_models import DSElement as P


def test_adjust_sample_rates_org_with_no_projects():
    p = AdjustedModel(projects=[])
    assert p.adjust_sample_rates(sample_rate=0.25) == []


def test_adjust_sample_rates_org_with_single_project():
    p = AdjustedModel(
        projects=[
            P(
                id=1,
                count=10,
            )
        ]
    )
    assert p.adjust_sample_rates(sample_rate=0.4) == [P(id=1, count=10, new_sample_rate=0.4)]


def test_adjust_sample_rates_org_with_few_projects():
    projects = [
        P(id=1, count=9),
        P(id=2, count=7),
        P(id=3, count=3),
        P(id=4, count=1),
    ]
    p = AdjustedModel(projects=projects)

    expected_projects = [
        P(
            id=1,
            count=9,
            new_sample_rate=pytest.approx(0.14814814814814817),
        ),
        P(
            id=2,
            count=7,
            new_sample_rate=pytest.approx(0.1904761904761905),
        ),
        P(
            id=3,
            count=3,
            new_sample_rate=pytest.approx(0.4444444444444444),
        ),
        P(
            id=4,
            count=1,
            new_sample_rate=1.0,
        ),
    ]

    assert (
        sorted(p.adjust_sample_rates(sample_rate=0.25), key=attrgetter("id")) == expected_projects
    )


def test_adjust_sample_rates_org_with_many_projects():
    """
    This test checks how we calculate sample rates for org with 30 projects
    and make sure model doesn't generate negative sample rate
    """
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
        P(
            id=p_id,
            count=count,
        )
        for p_id, count in target
    ]
    p = AdjustedModel(projects=projects)

    sample_rate = 0.036
    result = p.adjust_sample_rates(sample_rate)
    for p in result:
        assert 1.0 >= p.new_sample_rate > 0
        assert (p.count * sample_rate) / (
            p.count * p.new_sample_rate
        ) * p.new_sample_rate == pytest.approx(sample_rate)


def test_adjust_sample_rates_org_with_even_num_projects():
    projects = [
        P(id=1, count=8.0),
        P(id=2, count=7.0),
        P(id=3, count=3.0),
    ]
    p = AdjustedModel(projects=projects)

    expected_projects = [
        P(
            id=1,
            count=8.0,
            new_sample_rate=0.1875,
        ),
        P(
            id=2,
            count=7.0,
            new_sample_rate=pytest.approx(0.21428571428571427),
        ),
        P(
            id=3,
            count=3.0,
            new_sample_rate=0.5,
        ),
    ]

    assert (
        sorted(p.adjust_sample_rates(sample_rate=0.25), key=attrgetter("id")) == expected_projects
    )


def test_adjust_sample_rates_org_with_same_counts_projects():
    projects = [
        P(id=1, count=9.0),
        P(id=2, count=6.0),
        P(id=3, count=6.0),
        P(id=4, count=1.0),
    ]
    p = AdjustedModel(projects=projects)

    expected_projects = [
        P(
            id=1,
            count=9.0,
            new_sample_rate=pytest.approx(0.16666666666666666),
        ),
        P(
            id=2,
            count=6.0,
            new_sample_rate=0.25,
        ),
        P(
            id=3,
            count=6.0,
            new_sample_rate=0.25,
        ),
        P(
            id=4,
            count=1.0,
            new_sample_rate=1.0,
        ),
    ]

    assert (
        sorted(p.adjust_sample_rates(sample_rate=0.25), key=attrgetter("id")) == expected_projects
    )


def test_adjust_sample_rates_org_with_counts_projects():
    projects = [
        P(id=1, count=2.0),
        P(id=2, count=10.0),
        P(id=3, count=10.0),
        P(id=4, count=10.0),
    ]
    p = AdjustedModel(projects=projects)

    expected_projects = [
        P(
            id=1,
            count=2.0,
            new_sample_rate=1.0,
        ),
        P(
            id=2,
            count=10.0,
            new_sample_rate=0.2,
        ),
        P(
            id=3,
            count=10.0,
            new_sample_rate=0.2,
        ),
        P(
            id=4,
            count=10.0,
            new_sample_rate=0.2,
        ),
    ]

    assert (
        sorted(p.adjust_sample_rates(sample_rate=0.25), key=attrgetter("id")) == expected_projects
    )
