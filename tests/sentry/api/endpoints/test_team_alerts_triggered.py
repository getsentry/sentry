from sentry.incidents.models import (
    AlertRuleThresholdType,
    IncidentActivity,
    IncidentActivityType,
    IncidentStatus,
)
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
        activities = []
        for i in range(1, 9):
            activities.append(
                IncidentActivity(
                    incident=user_owned_incident,
                    type=IncidentActivityType.CREATED.value,
                    value=IncidentStatus.OPEN,
                    date_added=before_now(days=i),
                )
            )
        IncidentActivity.objects.bulk_create(activities)

        self.login_as(user=self.user)
        url = f"/api/0/teams/{self.team.organization.slug}/{self.team.slug}/alerts-triggered/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert len(response.data) == 8
        for i in response.data:
            assert i["count"] == 1

        url = f"/api/0/teams/{self.team.organization.slug}/{self.team.slug}/alerts-triggered/?statsPeriod=7d"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert len(response.data) == 6
        for i in response.data:
            assert i["count"] == 1

    def test_not_as_simple(self):
        team_with_user = self.create_team(
            organization=self.organization, name="Lonely Team", members=[self.user]
        )

        project1 = self.create_project(
            teams=[self.team], slug="foo"
        )  # This project will return counts for this team
        project2 = self.create_project(
            # teams=[team_with_user], slug="bar"
            teams=[team_with_user],
            slug="bar",
        )  # but not this project, cause this team isn't on it (but the user is)

        user_owned_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[project2],
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
        IncidentActivity.objects.create(
            incident=user_owned_incident,
            type=IncidentActivityType.CREATED.value,
            value=IncidentStatus.OPEN,
        )
        IncidentActivity.objects.create(
            incident=team_owned_incident,
            type=IncidentActivityType.CREATED.value,
            value=IncidentStatus.OPEN,
            date_added=before_now(days=2),
        )

        self.login_as(user=self.user)
        url = f"/api/0/teams/{self.team.organization.slug}/{self.team.slug}/alerts-triggered/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert (
            len(response.data) == 1
        )  # only getting the team owned incident, because the user owned incident is for another project that the team isn't on
