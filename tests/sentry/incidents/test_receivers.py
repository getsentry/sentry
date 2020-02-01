from __future__ import absolute_import

from sentry.snuba.models import QuerySubscription
from sentry.testutils import TestCase


class AddProjectToIncludeAllRulesTest(TestCase):
    def test_include_all_projects_enabled(self):
        alert_rule = self.create_alert_rule(include_all_projects=True)
        new_project = self.create_project()
        assert QuerySubscription.objects.filter(
            project=new_project, alert_rules=alert_rule
        ).exists()

    def test_include_all_projects_disabled(self):
        alert_rule = self.create_alert_rule(include_all_projects=False)
        new_project = self.create_project()
        assert not QuerySubscription.objects.filter(
            project=new_project, alert_rules=alert_rule
        ).exists()

    def test_update_noop(self):
        new_project = self.create_project()
        alert_rule = self.create_alert_rule(
            include_all_projects=True, excluded_projects=[new_project]
        )
        new_project.update(name="hi")
        assert not QuerySubscription.objects.filter(
            project=new_project, alert_rules=alert_rule
        ).exists()
