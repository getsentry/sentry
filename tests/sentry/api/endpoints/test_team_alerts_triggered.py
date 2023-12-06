from datetime import timezone

from sentry.incidents.models import (
    INCIDENT_STATUS,
    AlertRuleThresholdType,
    IncidentActivity,
    IncidentActivityType,
    IncidentStatus,
)
from sentry.models.actor import ActorTuple
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.silo import region_silo_test


@freeze_time()
@region_silo_test
class TeamAlertsTriggeredTotalsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-team-alerts-triggered"

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
                    value=INCIDENT_STATUS[IncidentStatus.OPEN],
                    date_added=before_now(days=i),
                )
            )
        IncidentActivity.objects.bulk_create(activities)

        self.login_as(user=self.user)
        response = self.get_success_response(self.team.organization.slug, self.team.slug)
        assert len(response.data) == 90
        for i in range(1, 9):
            assert (
                response.data[
                    str(
                        before_now(days=i)
                        .replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
                        .isoformat()
                    )
                ]
                == 1
            )

        for i in range(10, 90):
            assert (
                response.data[
                    str(
                        before_now(days=i)
                        .replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
                        .isoformat()
                    )
                ]
                == 0
            )

        response = self.get_success_response(
            self.team.organization.slug, self.team.slug, statsPeriod="7d"
        )
        assert len(response.data) == 7
        assert (
            response.data[
                str(
                    before_now(days=0)
                    .replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
                    .isoformat()
                )
            ]
            == 0
        )
        for i in range(1, 6):
            assert (
                response.data[
                    str(
                        before_now(days=i)
                        .replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
                        .isoformat()
                    )
                ]
                == 1
            )

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
            value=INCIDENT_STATUS[IncidentStatus.OPEN],
        )
        IncidentActivity.objects.create(
            incident=team_owned_incident,
            type=IncidentActivityType.CREATED.value,
            value=INCIDENT_STATUS[IncidentStatus.OPEN],
            date_added=before_now(days=2),
        )

        self.login_as(user=self.user)
        response = self.get_success_response(self.team.organization.slug, self.team.slug)
        assert len(response.data) == 90
        assert (
            response.data[
                str(
                    before_now(days=2)
                    .replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
                    .isoformat()
                )
            ]
            == 1
        )
        # only getting the team owned incident, because the user owned incident is for another project that the team isn't on
        for i in range(0, 90):
            if i != 2:
                assert (
                    response.data[
                        str(
                            before_now(days=i)
                            .replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
                            .isoformat()
                        )
                    ]
                    == 0
                )


@freeze_time()
@region_silo_test
class TeamAlertsTriggeredIndexEndpointTest(APITestCase):
    endpoint = "sentry-api-0-team-alerts-triggered-index"

    def test(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        user_owned_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[project1],
            name="user owned rule",
            owner=ActorTuple.from_actor_identifier(self.user.id),
        )

        user_owned_incident = self.create_incident(status=20, alert_rule=user_owned_rule)
        activities = []
        for i in range(0, 8):
            activities.append(
                IncidentActivity(
                    incident=user_owned_incident,
                    type=IncidentActivityType.CREATED.value,
                    value=INCIDENT_STATUS[IncidentStatus.OPEN],
                    date_added=before_now(weeks=i),
                )
            )
        team_owned_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[project1],
            name="team owned rule",
            owner=ActorTuple.from_actor_identifier(f"team:{self.team.id}"),
        )
        team_owned_incident = self.create_incident(status=20, alert_rule=team_owned_rule)
        activities.append(
            IncidentActivity(
                incident=team_owned_incident,
                type=IncidentActivityType.CREATED.value,
                value=INCIDENT_STATUS[IncidentStatus.OPEN],
                date_added=before_now(weeks=0),
            )
        )

        for i in range(0, 10):
            activities.append(
                IncidentActivity(
                    incident=team_owned_incident,
                    type=IncidentActivityType.CREATED.value,
                    value=INCIDENT_STATUS[IncidentStatus.OPEN],
                    date_added=before_now(weeks=i),
                )
            )
        IncidentActivity.objects.bulk_create(activities)

        self.login_as(user=self.user)
        response = self.get_success_response(
            self.team.organization.slug, self.team.slug, statsPeriod="8w"
        )
        assert [
            {"id": row["id"], "totalThisWeek": row["totalThisWeek"], "weeklyAvg": row["weeklyAvg"]}
            for row in response.data
        ] == [
            {"id": str(team_owned_rule.id), "totalThisWeek": 2, "weeklyAvg": 1.375},
            {"id": str(user_owned_rule.id), "totalThisWeek": 1, "weeklyAvg": 1},
        ]

        response = self.get_success_response(
            self.team.organization.slug, self.team.slug, per_page=1, statsPeriod="10w"
        )
        assert [
            {"id": row["id"], "totalThisWeek": row["totalThisWeek"], "weeklyAvg": row["weeklyAvg"]}
            for row in response.data
        ] == [
            {"id": str(team_owned_rule.id), "totalThisWeek": 2, "weeklyAvg": 1.1},
        ]
        next_cursor = self.get_cursor_headers(response)[1]
        response = self.get_success_response(
            self.team.organization.slug,
            self.team.slug,
            per_page=1,
            cursor=next_cursor,
            statsPeriod="10w",
        )
        assert [
            {"id": row["id"], "totalThisWeek": row["totalThisWeek"], "weeklyAvg": row["weeklyAvg"]}
            for row in response.data
        ] == [
            {"id": str(user_owned_rule.id), "totalThisWeek": 1, "weeklyAvg": 0.8},
        ]
