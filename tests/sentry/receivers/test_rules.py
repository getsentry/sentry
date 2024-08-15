from sentry.analytics.events import project_created
from tests.sentry.auth.test_access import AccessFactoryTestCase


class DefaultRulesTest(AccessFactoryTestCase):
    def test_include_all_projects_enabled(self):
        request = self.make_request(user=self.user)
        accesses = [
            self.from_user(self.user, self.organization),
            self.from_request(request, self.organization),
        ]

        for access in accesses:
            project_created.send(
                project=self.project,
                default_rules=True,
                user=self.user,
                access=None,
                sender=DefaultRulesTest,
            )
