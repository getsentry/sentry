from sentry.dynamic_sampling.tasks.helpers.sample_rate import get_org_sample_rate
from sentry.models.options.organization_option import OrganizationOption
from sentry.testutils.cases import BaseMetricsLayerTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.features import with_feature


class PrioritiseProjectsSnubaQueryTest(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    @with_feature(["organizations:dynamic-sampling", "organizations:dynamic-sampling-custom"])
    def test_get_org_sample_rate_from_target_sample_rate(self):
        org1 = self.create_organization("test-org")

        OrganizationOption.objects.create(
            organization=org1, key="sentry:target_sample_rate", value=0.5
        )

        sample_rate, success = get_org_sample_rate(org1.id, None)
        assert success
        assert sample_rate == 0.5

    @with_feature(["organizations:dynamic-sampling", "organizations:dynamic-sampling-custom"])
    def test_get_org_sample_rate_from_target_sample_rate_missing(self):
        org1 = self.create_organization("test-org")

        sample_rate, success = get_org_sample_rate(org1.id, None)
        assert not success
        assert sample_rate == 1.0

    @with_feature(["organizations:dynamic-sampling", "organizations:dynamic-sampling-custom"])
    def test_get_org_sample_rate_from_target_sample_rate_missing_default(self):
        org1 = self.create_organization("test-org")

        sample_rate, success = get_org_sample_rate(org1.id, 0.7)
        assert not success
        assert sample_rate == 0.7
