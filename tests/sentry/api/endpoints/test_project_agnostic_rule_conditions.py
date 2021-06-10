from django.urls import reverse

from sentry.testutils import APITestCase


class ProjectAgnosticRuleConditionsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name="baz")
        url = reverse("sentry-api-0-project-agnostic-rule-conditions", args=[org.slug])
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 9

    def test_percent_condition_flag(self):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name="bazzy")
        url = reverse("sentry-api-0-project-agnostic-rule-conditions", args=[org.slug])
        with self.feature({"organizations:issue-percent-filters": True}):
            # We should get back the condition.
            response = self.client.get(url, format="json")

            assert response.status_code == 200, response.content
            assert len(response.data) == 10
            found = False
            for condition in response.data:
                if (
                    condition["id"]
                    != "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition"
                ):
                    found = True
            assert found is True
