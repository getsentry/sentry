from sentry.dynamic_sampling.tasks.helpers.sample_rate import get_org_sample_rate
from sentry.models.options.organization_option import OrganizationOption
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class GetOrgSampleRateTest(TestCase):
    @with_feature(["organizations:dynamic-sampling", "organizations:dynamic-sampling-custom"])
    def test_get_org_sample_rate_from_target_sample_rate(self) -> None:
        org1 = self.create_organization("test-org")

        OrganizationOption.objects.create(
            organization=org1, key="sentry:target_sample_rate", value=0.5
        )

        sample_rate, success = get_org_sample_rate(org1.id, None)
        assert success
        assert sample_rate == 0.5

    @with_feature(["organizations:dynamic-sampling", "organizations:dynamic-sampling-custom"])
    def test_get_org_sample_rate_from_target_sample_rate_missing(self) -> None:
        org1 = self.create_organization("test-org")

        sample_rate, success = get_org_sample_rate(org1.id, None)
        assert not success
        assert sample_rate == 1.0

    @with_feature(["organizations:dynamic-sampling", "organizations:dynamic-sampling-custom"])
    def test_get_org_sample_rate_from_target_sample_rate_missing_default(self) -> None:
        org1 = self.create_organization("test-org")

        sample_rate, success = get_org_sample_rate(org1.id, 0.7)
        assert not success
        assert sample_rate == 0.7

    @with_feature("organizations:dynamic-sampling")
    def test_get_org_sample_rate_without_custom_dynamic_sampling_returns_default(self) -> None:
        org1 = self.create_organization("test-org")
        OrganizationOption.objects.create(
            organization=org1, key="sentry:target_sample_rate", value=0.5
        )

        assert get_org_sample_rate(org1.id, 0.7) == (0.7, False)
        assert get_org_sample_rate(org1.id, None) == (None, False)
