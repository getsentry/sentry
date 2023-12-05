from datetime import datetime

from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationProjectsSentFirstEventEndpointTest(APITestCase):
    def setUp(self):
        self.foo = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org)
        self.url = reverse(
            "sentry-api-0-organization-sent-first-event",
            kwargs={"organization_slug": self.org.slug},
        )

    def test_simple_sent_first_event(self):
        self.create_project(teams=[self.team], first_event=datetime.now())
        self.create_member(organization=self.org, user=self.foo, teams=[self.team])

        self.login_as(user=self.foo)

        response = self.client.get(self.url)
        assert response.status_code == 200

        assert response.data["sentFirstEvent"]

    def test_simple_no_first_event(self):
        self.create_project(teams=[self.team])
        self.create_member(organization=self.org, user=self.foo, teams=[self.team])

        self.login_as(user=self.foo)

        response = self.client.get(self.url)
        assert response.status_code == 200

        assert not response.data["sentFirstEvent"]

    def test_first_event_in_org(self):
        self.create_project(teams=[self.team], first_event=datetime.now())
        self.create_member(organization=self.org, user=self.foo)

        self.login_as(user=self.foo)

        response = self.client.get(f"{self.url}?project=-1")
        assert response.status_code == 200

        assert response.data["sentFirstEvent"]

    def test_no_first_event_in_member_projects(self):
        self.create_project(teams=[self.team], first_event=datetime.now())
        self.create_member(organization=self.org, user=self.foo)

        self.login_as(user=self.foo)

        response = self.client.get(self.url)
        assert response.status_code == 200

        assert not response.data["sentFirstEvent"]

    def test_first_event_from_project_ids(self):
        project = self.create_project(teams=[self.team], first_event=datetime.now())
        self.create_member(organization=self.org, user=self.foo)

        self.login_as(user=self.foo)

        response = self.client.get(f"{self.url}?project={project.id}")
        assert response.status_code == 200

        assert response.data["sentFirstEvent"]
