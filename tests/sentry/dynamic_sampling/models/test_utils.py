from sentry.dynamic_sampling.models.utils import actual_sample_rate


def test_actual_sample_rate_didnt_raise_exception():
    assert actual_sample_rate(0, 0) == 0.0


def test_actual_sample_rate():
    assert actual_sample_rate(count_keep=10, count_drop=10) == 0.5
    assert actual_sample_rate(count_keep=1, count_drop=0) == 1.0
    assert actual_sample_rate(count_keep=0, count_drop=1) == 0.0
