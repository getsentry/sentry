from rest_framework import status

from sentry.constants import ObjectStatus
from sentry.models import Rule
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class ProjectRuleEnableTestCase(APITestCase):
    endpoint = "sentry-api-0-project-rule-enable"
    method = "PUT"

    def setUp(self):
        self.rule = self.create_project_rule(project=self.project)
        self.login_as(user=self.user)

    def test_simple(self):
        self.rule.status = ObjectStatus.DISABLED
        self.rule.save()
        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.rule.id,
            status_code=status.HTTP_202_ACCEPTED,
        )
        assert Rule.objects.filter(id=self.rule.id, status=ObjectStatus.ACTIVE).exists()

    def test_rule_not_found(self):
        # maybe it's not disabled
        pass

    def test_duplicate_rule(self):
        pass

    def test_no_action_rule(self):
        pass
