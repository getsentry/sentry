from unittest.mock import patch

import pytest

from sentry.dynamic_sampling.rules.utils import apply_dynamic_factor
from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.dynamic_sampling.utils import (
    get_org_sample_rate,
    has_custom_dynamic_sampling,
    has_dynamic_sampling,
    is_project_mode_sampling,
)
from sentry.models.options.organization_option import OrganizationOption
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


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
        with patch("sentry.quotas.backend.get_blended_sample_rate", return_value=0.5):
            assert has_dynamic_sampling(org1)

    def test_zero_rate_is_enabled(self) -> None:
        org1 = self.create_organization("test-org")
        with patch("sentry.quotas.backend.get_blended_sample_rate", return_value=0.0):
            assert has_dynamic_sampling(org1)

    def test_full_rate_is_enabled(self) -> None:
        org1 = self.create_organization("test-org")
        with patch("sentry.quotas.backend.get_blended_sample_rate", return_value=1.0):
            assert has_dynamic_sampling(org1)

    def test_negative(self) -> None:
        org1 = self.create_organization("test-org")
        with patch("sentry.quotas.backend.get_blended_sample_rate", return_value=None):
            assert not has_dynamic_sampling(org1)


class HasCustomDynamicSamplingTestCase(TestCase):
    def test_no_org(self) -> None:
        assert not has_dynamic_sampling(None)

    def test_positive(self) -> None:
        org1 = self.create_organization("test-org")
        with self.feature("organizations:dynamic-sampling-custom"):
            assert has_custom_dynamic_sampling(org1)

    def test_negative(self) -> None:
        org1 = self.create_organization("test-org")
        with self.feature({"organizations:dynamic-sampling-custom": False}):
            assert not has_custom_dynamic_sampling(org1)


class IsProjectModeSamplingTestCase(TestCase):
    def test_no_org(self) -> None:
        assert not has_dynamic_sampling(None)

    def test_no_custom_dynamic_samping(self) -> None:
        org1 = self.create_organization("test-org")
        with self.feature({"organizations:dynamic-sampling-custom": False}):
            assert not is_project_mode_sampling(org1)

    def test_positive(self) -> None:
        org1 = self.create_organization("test-org")
        org1.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT.value)
        with self.feature("organizations:dynamic-sampling-custom"):
            assert is_project_mode_sampling(org1)

    def test_negative(self) -> None:
        org1 = self.create_organization("test-org")
        org1.update_option("sentry:sampling_mode", DynamicSamplingMode.ORGANIZATION.value)
        with self.feature({"organizations:dynamic-sampling-custom": False}):
            assert not is_project_mode_sampling(org1)


class GetOrgSampleRateTest(TestCase):
    @with_feature("organizations:dynamic-sampling-custom")
    def test_get_org_sample_rate_from_target_sample_rate(self) -> None:
        org1 = self.create_organization("test-org")

        OrganizationOption.objects.create(
            organization=org1, key="sentry:target_sample_rate", value=0.5
        )

        sample_rate, success = get_org_sample_rate(org1.id, None)
        assert success
        assert sample_rate == 0.5

    @with_feature("organizations:dynamic-sampling-custom")
    def test_get_org_sample_rate_from_target_sample_rate_missing(self) -> None:
        org1 = self.create_organization("test-org")

        sample_rate, success = get_org_sample_rate(org1.id, None)
        assert not success
        assert sample_rate == 1.0

    @with_feature("organizations:dynamic-sampling-custom")
    def test_get_org_sample_rate_from_target_sample_rate_missing_default(self) -> None:
        org1 = self.create_organization("test-org")

        sample_rate, success = get_org_sample_rate(org1.id, 0.7)
        assert not success
        assert sample_rate == 0.7

    def test_get_org_sample_rate_without_custom_dynamic_sampling_returns_default(self) -> None:
        org1 = self.create_organization("test-org")
        OrganizationOption.objects.create(
            organization=org1, key="sentry:target_sample_rate", value=0.5
        )

        assert get_org_sample_rate(org1.id, 0.7) == (0.7, False)
        assert get_org_sample_rate(org1.id, None) == (None, False)

    def test_get_org_sample_rate_for_unknown_organization_returns_default(self) -> None:
        assert get_org_sample_rate(0, 0.7) == (0.7, False)
