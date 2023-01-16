from sentry.dynamic_sampling.models.adjustment_models import AdjustedModel
from sentry.dynamic_sampling.models.adjustment_models import Project as P


def test_adjust_sample_rates_org_wo_projects():
    p = AdjustedModel(projects=[], fidelity_rate=0.04)
    assert p.adjust_sample_rates() == []


def test_adjust_sample_rates_org_with_single_project():
    p = AdjustedModel(projects=[P(id=1, total=10)], fidelity_rate=0.04)
    assert p.adjust_sample_rates() == [P(id=1, total=10)]
