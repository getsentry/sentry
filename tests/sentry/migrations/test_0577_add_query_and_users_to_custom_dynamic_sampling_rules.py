from datetime import timedelta

from django.utils import timezone

from sentry.models.dynamicsampling import CustomDynamicSamplingRule
from sentry.testutils.cases import TestMigrations


class AddQueryField(TestMigrations):
    migrate_from = "0576_add_missing_org_integration_scope"
    migrate_to = "0577_add_query_and_users_to_custom_dynamic_sampling_rules"

    def setup_before_migration(self, apps):
        condition = '{"op": "equals", "name": "environment", "value": "prod"}'
        hash = "some_hash"

        start = timezone.now()
        end = timezone.now() + timedelta(hours=1)

        self.rule = CustomDynamicSamplingRule.objects.create(
            organization_id=self.organization.id,
            condition=condition,
            sample_rate=0.5,
            start_date=start,
            end_date=end,
            num_samples=100,
            condition_hash=hash,
            is_active=True,
            is_org_level=True,
        )

    def test(self):
        rules = CustomDynamicSamplingRule.objects.all()

        assert len(rules) == 1
        rule = rules[0]
        assert rule.query is None
        assert rule.users.count() == 0
        assert rule.projects.count() == 0
        assert rule == self.rule
