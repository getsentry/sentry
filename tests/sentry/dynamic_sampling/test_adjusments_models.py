from sentry.dynamic_sampling.adjustment_models import AdjustedModel, Project


def test_adjust_sample_rates():
    p1 = Project(id=1, total=8)
    p2 = Project(id=2, total=240)
    p = AdjustedModel(projects=[p1, p2], fidelity_rate=0.04)
    assert p.adjust_sample_rates() == [116, 132]
