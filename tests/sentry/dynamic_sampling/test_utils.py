from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.dynamic_sampling.utils import (
    has_custom_dynamic_sampling,
    has_dynamic_sampling,
    is_project_mode_sampling,
)
from sentry.testutils.cases import TestCase


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
