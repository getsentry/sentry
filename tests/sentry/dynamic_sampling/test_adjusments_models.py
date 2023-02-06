from sentry.dynamic_sampling.models.adjustment_models import AdjustedModel
from sentry.dynamic_sampling.models.adjustment_models import Project as P


def test_adjust_sample_rates_org_wo_projects():
    p = AdjustedModel(projects=[], fidelity_rate=0.04)
    assert p.adjust_sample_rates == []


def test_adjust_sample_rates_org_with_single_project():
    p = AdjustedModel(
        projects=[P(id=1, count_per_root=10, blended_sample_rate=0.04)], fidelity_rate=0.04
    )
    assert p.adjust_sample_rates == [P(id=1, count_per_root=10, blended_sample_rate=0.04)]


def test_adjust_sample_rates_org_with_few_projects():
    projects = [
        P(id=1, count_per_root=9.0, blended_sample_rate=0.04),
        P(id=2, count_per_root=7.0, blended_sample_rate=0.04),
        P(id=3, count_per_root=3.0, blended_sample_rate=0.04),
        P(id=4, count_per_root=1.0, blended_sample_rate=0.04),
    ]
    p = AdjustedModel(projects=projects, fidelity_rate=0.25)

    expected_projects = [
        P(id=1, count_per_root=9.0, new_count_per_root=6.0, blended_sample_rate=0.04),
        P(id=2, count_per_root=7.0, new_count_per_root=5.5, blended_sample_rate=0.04),
        P(id=3, count_per_root=3.0, new_count_per_root=4.5, blended_sample_rate=0.04),
        P(id=4, count_per_root=1.0, new_count_per_root=4.0, blended_sample_rate=0.04),
    ]

    assert p.adjust_sample_rates == expected_projects
