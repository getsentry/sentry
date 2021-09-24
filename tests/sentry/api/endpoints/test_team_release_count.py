from datetime import datetime

from sentry.incidents.models import AlertRuleThresholdType, IncidentTrigger, TriggerStatus
from sentry.models import ActorTuple, Release
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import before_now


class TeamReleaseCountTest(APITestCase):
    endpoint = "sentry-api-0-team-release-count"

    def test_simple(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org2 = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project1 = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team2], organization=org2)
        project3 = self.create_project(teams=[team1], organization=org)

        print("project1:", project1.id)
        print("project2:", project2.id)
        print("project3:", project3.id)
        self.create_member(teams=[team1], user=user, organization=org)

        self.login_as(user=user)

        release1 = Release.objects.create(
            organization_id=org.id, version="1", date_added=datetime(2013, 8, 13, 3, 8, 24, 880386)
        )
        release1.add_project(project1)

        release2 = Release.objects.create(
            organization_id=org2.id, version="2", date_added=datetime(2013, 8, 14, 3, 8, 24, 880386)
        )  # This release isn't returned, its in another org
        release2.add_project(project2)

        release3 = Release.objects.create(
            organization_id=org.id,
            version="3",
            date_added=datetime(2013, 8, 12, 3, 8, 24, 880386),
            date_released=datetime(2013, 8, 15, 3, 8, 24, 880386),
        )
        release3.add_project(project3)

        release4 = Release.objects.create(
            organization_id=org.id, version="4", date_added=datetime(2013, 8, 14, 3, 8, 24, 880386)
        )
        release4.add_project(project3)
        release5 = Release.objects.create(
            organization_id=org.id, version="4", date_added=datetime(2013, 8, 14, 3, 8, 24, 880386)
        )
        release5.add_project(project3)

        response = self.get_valid_response(org.slug, team1.slug)

        print("response:", response)
