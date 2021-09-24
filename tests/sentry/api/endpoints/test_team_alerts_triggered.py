from sentry.incidents.models import AlertRuleThresholdType, IncidentTrigger, TriggerStatus
from sentry.models import ActorTuple
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import before_now


class TeamAlertsTriggeredTest(APITestCase):
    def test_simple(self):
        project1 = self.create_project(
            teams=[self.team], slug="foo"
        )  # This project will return counts for this team
        user_owned_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[project1],
            name="user owned rule",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
            owner=ActorTuple.from_actor_identifier(self.user.id),
        )
        user_owned_incident = self.create_incident(status=20, alert_rule=user_owned_rule)
        for i in range(1, 31):
            trigger = self.create_alert_rule_trigger(user_owned_rule, i, 200)
            trigger2 = self.create_alert_rule_trigger(user_owned_rule, -i, 200)
            IncidentTrigger.objects.create(
                incident=user_owned_incident,
                alert_rule_trigger=trigger,
                status=TriggerStatus.ACTIVE.value,
                date_added=before_now(days=i),
            )
            IncidentTrigger.objects.create(
                incident=user_owned_incident,
                alert_rule_trigger=trigger2,
                status=TriggerStatus.ACTIVE.value,
                date_added=before_now(days=i),
            )

        self.login_as(user=self.user)
        url = f"/api/0/teams/{self.team.organization.slug}/{self.team.slug}/alerts-triggered/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert len(response.data) == 30
        for i in response.data:
            assert i["count"] == 2

        url = f"/api/0/teams/{self.team.organization.slug}/{self.team.slug}/alerts-triggered/?statsPeriod=14d"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert len(response.data) == 13
        for i in response.data:
            assert i["count"] == 2

    def test_not_as_simple(self):
        team_with_user = self.create_team(
            organization=self.organization, name="Lonely Team", members=[self.user]
        )

        project1 = self.create_project(
            teams=[self.team], slug="foo"
        )  # This project will return counts for this team
        project2 = self.create_project(
            teams=[team_with_user], slug="bar"
        )  # but not this project, cause this team isn't on it (but the user is)

        user_owned_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[project1],
            name="user owned rule",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
            owner=ActorTuple.from_actor_identifier(self.user.id),
        )
        user_owned_incident = self.create_incident(
            projects=[project2], status=20, alert_rule=user_owned_rule
        )
        team_owned_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[project1],
            name="team owned rule",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
            owner=ActorTuple.from_actor_identifier(f"team:{self.team.id}"),
        )
        team_owned_incident = self.create_incident(
            projects=[project1], status=20, alert_rule=team_owned_rule
        )

        trigger = self.create_alert_rule_trigger(team_owned_rule, "hi", 100)
        trigger2 = self.create_alert_rule_trigger(team_owned_rule, "bye", 50)
        trigger3 = self.create_alert_rule_trigger(user_owned_rule, "meow", 200)
        trigger4 = self.create_alert_rule_trigger(user_owned_rule, "woof", 200)
        IncidentTrigger.objects.create(
            incident=user_owned_incident,
            alert_rule_trigger=trigger,
            status=TriggerStatus.RESOLVED.value,
        )  # Resolved trigger doesn't get counted.
        IncidentTrigger.objects.create(
            incident=user_owned_incident,
            alert_rule_trigger=trigger2,
            status=TriggerStatus.ACTIVE.value,
        )
        IncidentTrigger.objects.create(
            incident=team_owned_incident,
            alert_rule_trigger=trigger3,
            status=TriggerStatus.ACTIVE.value,
            date_added=before_now(days=2),
        )
        IncidentTrigger.objects.create(
            incident=user_owned_incident,
            alert_rule_trigger=trigger4,
            status=TriggerStatus.ACTIVE.value,
            date_added=before_now(days=4),
        )

        self.login_as(user=self.user)
        url = f"/api/0/teams/{self.team.organization.slug}/{self.team.slug}/alerts-triggered/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert (
            len(response.data) == 1
        )  # only getting the team owned incident, because the user owned incident is for another project
