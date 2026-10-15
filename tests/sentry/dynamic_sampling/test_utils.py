import pytest

from sentry.dynamic_sampling.rules.utils import apply_dynamic_factor
from sentry.dynamic_sampling.utils import has_dynamic_sampling
from sentry.testutils.cases import TestCase


@pytest.mark.parametrize(
    ["base_sample_rate", "x", "expected"],
    [
        (0.0, 2.0, 2.0),
        (0.1, 2.0, 1.8660659830736148),
        (0.5, 3.0, 1.7320508075688774),
        (1.0, 4.0, 1.0),
    ],
)
def test_apply_dynamic_factor_with_valid_params(base_sample_rate, x, expected) -> None:
    assert apply_dynamic_factor(base_sample_rate, x) == pytest.approx(expected)


@pytest.mark.parametrize(["base_sample_rate", "x"], [(-0.1, 1.5), (1.1, 2.5), (0.5, 0)])
def test_apply_dynamic_factor_with_invalid_params(base_sample_rate, x) -> None:
    with pytest.raises(Exception):
        apply_dynamic_factor(base_sample_rate, x)


class HasDynamicSamplingTestCase(TestCase):
    def test_no_org(self) -> None:
        assert not has_dynamic_sampling(None)

    def test_positive(self) -> None:
        org1 = self.create_organization("test-org")
        with self.feature("organizations:dynamic-sampling"):
            assert has_dynamic_sampling(org1)

    def test_negative(self) -> None:
        org1 = self.create_organization("test-org")
        with self.feature({"organizations:dynamic-sampling": False}):
            assert not has_dynamic_sampling(org1)
