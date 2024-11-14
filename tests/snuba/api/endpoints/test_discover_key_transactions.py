from __future__ import annotations

from typing import Any, Protocol

from django.http.response import HttpResponse
from django.urls import reverse

from sentry.discover.models import MAX_TEAM_KEY_TRANSACTIONS, TeamKeyTransaction
from sentry.models.projectteam import ProjectTeam
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.pagination import override_pagination_limit
from sentry.utils.samples import load_data


class TeamKeyTransactionTestBase(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()

        self.login_as(user=self.user, superuser=False)
        self.org = self.create_organization(owner=self.user, name="foo")
        self.project = self.create_project(name="baz", organization=self.org)
        self.event_data = load_data("transaction")

        self.features = ["organizations:performance-view"]


class ClientCallable(Protocol):
    def __call__(
        self, url: str, data: dict[str, Any], format: str, **kwargs: Any
    ) -> HttpResponse: ...


class TeamKeyTransactionTest(TeamKeyTransactionTestBase):
    def setUp(self):
        super().setUp()
        self.url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])

    def test_key_transaction_without_feature(self):
        project = self.create_project(name="qux", organization=self.org)
        data = {
            "project": [self.project.id, project.id],
            "transaction": self.event_data["transaction"],
            "team": "myteams",
        }
        for response in (
            self.client.get(self.url, data=data, format="json"),
            self.client.post(self.url, data=data, format="json"),
            self.client.delete(self.url, data=data, format="json"),
        ):
            assert response.status_code == 404, response.content

    def test_get_key_transaction_multiple_projects(self):
        project = self.create_project(name="qux", organization=self.org)
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                data={
                    "project": [self.project.id, project.id],
                    "transaction": self.event_data["transaction"],
                },
                format="json",
            )
        assert response.status_code == 400, response.content
        assert response.data == {"detail": "Only 1 project per Key Transaction"}

    def test_get_key_transaction_no_transaction_name(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                data={
                    "project": [self.project.id],
                },
                format="json",
            )
        assert response.status_code == 400, response.content
        assert response.data == {"detail": "A transaction name is required"}

    def test_get_no_key_transaction(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.event_data["transaction"],
                },
                format="json",
            )
        assert response.status_code == 200, response.content
        assert response.data == []

    def test_get_key_transaction_my_teams(self):
        team1 = self.create_team(organization=self.org, name="Team A")
        team2 = self.create_team(organization=self.org, name="Team B")
        team3 = self.create_team(organization=self.org, name="Team C")
        # should not be in response because we never joined this team
        self.create_team(organization=self.org, name="Team D")

        # only join teams 1,2,3
        for team in [team1, team2, team3]:
            self.create_team_membership(team, user=self.user)
            self.project.add_team(team)

        TeamKeyTransaction.objects.bulk_create(
            [
                TeamKeyTransaction(
                    organization=self.org,
                    project_team=project_team,
                    transaction=self.event_data["transaction"],
                )
                for project_team in ProjectTeam.objects.filter(
                    project=self.project, team__in=[team1, team2]
                )
            ]
            + [
                TeamKeyTransaction(
                    organization=self.org,
                    project_team=project_team,
                    transaction="other-transaction",
                )
                for project_team in ProjectTeam.objects.filter(
                    project=self.project, team__in=[team2, team3]
                )
            ]
        )

        with self.feature(self.features):
            response = self.client.get(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.event_data["transaction"],
                    "team": "myteams",
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "team": str(team1.id),
            },
            {
                "team": str(team2.id),
            },
        ]

    def test_post_key_transaction_more_than_1_project(self):
        team = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team, user=self.user)
        self.project.add_team(team)
        project = self.create_project(name="bar", organization=self.org)
        project.add_team(team)

        with self.feature(self.features):
            response = self.client.post(
                self.url,
                data={
                    "project": [self.project.id, project.id],
                    "transaction": self.event_data["transaction"],
                    "team": [team.id],
                },
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data == {"detail": "Only 1 project per Key Transaction"}

    def test_post_key_transaction_no_team(self):
        team = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team, user=self.user)
        self.project.add_team(team)

        with self.feature(self.features):
            response = self.client.post(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.event_data["transaction"],
                },
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data == {"team": ["This field is required."]}

    def test_post_key_transaction_no_transaction_name(self):
        team = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team, user=self.user)
        self.project.add_team(team)

        with self.feature(self.features):
            response = self.client.post(
                self.url,
                data={
                    "project": [self.project.id],
                    "team": [team.id],
                },
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data == {"transaction": ["This field is required."]}

    def test_post_key_transaction_no_access_team(self):
        org = self.create_organization(
            owner=self.user,  # use other user as owner
            name="foo",
            flags=0,  # disable default allow_joinleave
        )
        project = self.create_project(name="baz", organization=org)

        user = self.create_user()
        self.login_as(user=user, superuser=False)

        team = self.create_team(organization=org, name="Team Foo")
        self.create_team_membership(team, user=user)
        project.add_team(team)

        other_team = self.create_team(organization=org, name="Team Bar")
        project.add_team(other_team)

        with self.feature(self.features):
            response = self.client.post(
                reverse("sentry-api-0-organization-key-transactions", args=[org.slug]),
                data={
                    "project": [project.id],
                    "transaction": self.event_data["transaction"],
                    "team": [other_team.id],
                },
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data == {
            "team": [f"You do not have permission to access {other_team.name}"]
        }

    def test_post_key_transaction_no_access_project(self):
        team1 = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team1, user=self.user)
        self.project.add_team(team1)

        team2 = self.create_team(organization=self.org, name="Team Bar")
        self.create_team_membership(team2, user=self.user)

        with self.feature(self.features):
            response = self.client.post(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.event_data["transaction"],
                    "team": [team2.id],
                },
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data == {"detail": "Team does not have access to project"}

    def test_post_key_transactions_exceed_limit(self):
        team = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team, user=self.user)
        self.project.add_team(team)

        project_team = ProjectTeam.objects.get(project=self.project, team=team)

        TeamKeyTransaction.objects.bulk_create(
            [
                TeamKeyTransaction(
                    organization=self.org,
                    project_team=project_team,
                    transaction=f"{self.event_data['transaction']}-{i}",
                )
                for i in range(MAX_TEAM_KEY_TRANSACTIONS)
            ]
        )

        with self.feature(self.features):
            response = self.client.post(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.event_data["transaction"],
                    "team": [team.id],
                },
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data == {
            "non_field_errors": [
                f"At most {MAX_TEAM_KEY_TRANSACTIONS} Key Transactions can be added for a team"
            ]
        }

    def test_post_key_transaction_limit_is_per_team(self):
        team1 = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team1, user=self.user)
        self.project.add_team(team1)

        team2 = self.create_team(organization=self.org, name="Team Bar")
        self.create_team_membership(team2, user=self.user)
        self.project.add_team(team2)

        project_teams = ProjectTeam.objects.filter(project=self.project, team__in=[team1, team2])

        TeamKeyTransaction.objects.bulk_create(
            [
                TeamKeyTransaction(
                    organization=self.org,
                    project_team=project_team,
                    transaction=f"{self.event_data['transaction']}-{i}",
                )
                for project_team in project_teams
                for i in range(MAX_TEAM_KEY_TRANSACTIONS - 1)
            ]
        )

        with self.feature(self.features):
            response = self.client.post(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.event_data["transaction"],
                    "team": [team1.id, team2.id],
                },
                format="json",
            )

        assert response.status_code == 201, response.content
        key_transactions = TeamKeyTransaction.objects.filter(project_team__team__in=[team1, team2])
        assert len(key_transactions) == 2 * MAX_TEAM_KEY_TRANSACTIONS

    def test_post_key_transactions(self):
        team = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team, user=self.user)
        self.project.add_team(team)

        with self.feature(self.features):
            response = self.client.post(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.event_data["transaction"],
                    "team": [team.id],
                },
                format="json",
            )

        assert response.status_code == 201, response.content
        key_transactions = TeamKeyTransaction.objects.filter(project_team__team=team)
        assert len(key_transactions) == 1

    def test_post_key_transactions_duplicate(self):
        team = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team, user=self.user)
        self.project.add_team(team)

        project_team = ProjectTeam.objects.get(project=self.project, team=team)

        TeamKeyTransaction.objects.create(
            organization=self.org,
            project_team=project_team,
            transaction=self.event_data["transaction"],
        )

        with self.feature(self.features):
            response = self.client.post(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.event_data["transaction"],
                    "team": [team.id],
                },
                format="json",
            )

        assert response.status_code == 204, response.content
        key_transactions = TeamKeyTransaction.objects.filter(
            project_team=project_team, transaction=self.event_data["transaction"]
        )
        assert len(key_transactions) == 1

    def test_post_key_transaction_multiple_team(self):
        team1 = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team1, user=self.user)
        self.project.add_team(team1)

        team2 = self.create_team(organization=self.org, name="Team Bar")
        self.create_team_membership(team2, user=self.user)
        self.project.add_team(team2)

        with self.feature(self.features):
            response = self.client.post(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.event_data["transaction"],
                    "team": [team1.id, team2.id],
                },
                format="json",
            )

        assert response.status_code == 201, response.content
        key_transactions = TeamKeyTransaction.objects.filter(
            project_team__in=ProjectTeam.objects.filter(
                project=self.project, team__in=[team1, team2]
            ),
            transaction=self.event_data["transaction"],
        )
        assert len(key_transactions) == 2

    def test_post_key_transaction_partially_existing_teams(self):
        team1 = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team1, user=self.user)
        self.project.add_team(team1)

        team2 = self.create_team(organization=self.org, name="Team Bar")
        self.create_team_membership(team2, user=self.user)
        self.project.add_team(team2)

        TeamKeyTransaction.objects.create(
            organization=self.org,
            project_team=ProjectTeam.objects.get(project=self.project, team=team1),
            transaction=self.event_data["transaction"],
        )

        with self.feature(self.features):
            response = self.client.post(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.event_data["transaction"],
                    "team": [team1.id, team2.id],
                },
                format="json",
            )

        assert response.status_code == 201, response.content
        key_transactions = TeamKeyTransaction.objects.filter(
            project_team__in=ProjectTeam.objects.filter(
                project=self.project, team__in=[team1, team2]
            ),
            transaction=self.event_data["transaction"],
        )
        assert len(key_transactions) == 2

    def test_post_key_transaction_multiple_users(self):
        team = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team, user=self.user)
        self.project.add_team(team)

        with self.feature(self.features):
            response = self.client.post(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.event_data["transaction"],
                    "team": [team.id],
                },
                format="json",
            )

        assert response.status_code == 201, response.content

        with self.feature(self.features):
            response = self.client.post(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.event_data["transaction"],
                    "team": [team.id],
                },
                format="json",
            )

        # already created by this user, so it's 204 this time
        assert response.status_code == 204, response.content

        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member")
        self.create_team_membership(team, user=user)
        self.login_as(user=user, superuser=False)
        with self.feature(self.features):
            response = self.client.post(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.event_data["transaction"],
                    "team": [team.id],
                },
                format="json",
            )

        # already created by another user, so it's 204 this time
        assert response.status_code == 204, response.content

        # should only create 1 team key transaction
        key_transactions = TeamKeyTransaction.objects.filter(project_team__team=team)
        assert len(key_transactions) == 1

    def test_post_key_transaction_overly_long_transaction(self):
        team = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team, user=self.user)
        self.project.add_team(team)

        with self.feature(self.features):
            response = self.client.post(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": "a" * 500,
                    "team": [team.id],
                },
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data == {
            "transaction": ["Ensure this field has no more than 200 characters."]
        }

    def test_delete_key_transaction_no_transaction_name(self):
        team = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team, user=self.user)
        self.project.add_team(team)

        with self.feature(self.features):
            response = self.client.delete(
                self.url,
                data={
                    "project": [self.project.id],
                    "team": [team.id],
                },
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data == {"transaction": ["This field is required."]}

    def test_delete_key_transaction_no_team(self):
        team = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team, user=self.user)
        self.project.add_team(team)

        with self.feature(self.features):
            response = self.client.delete(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.event_data["transaction"],
                },
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data == {"team": ["This field is required."]}

    def test_delete_key_transactions_no_exist(self):
        team = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team, user=self.user)
        self.project.add_team(team)

        with self.feature(self.features):
            response = self.client.delete(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.event_data["transaction"],
                    "team": [team.id],
                },
                format="json",
            )

        assert response.status_code == 204, response.content
        key_transactions = TeamKeyTransaction.objects.filter(project_team__team=team)
        assert len(key_transactions) == 0

    def test_delete_key_transaction_no_access_team(self):
        org = self.create_organization(
            owner=self.user,  # use other user as owner
            name="foo",
            flags=0,  # disable default allow_joinleave
        )
        project = self.create_project(name="baz", organization=org)

        user = self.create_user()
        self.login_as(user=user, superuser=False)

        team = self.create_team(organization=org, name="Team Foo")
        self.create_team_membership(team, user=user)
        project.add_team(team)

        other_team = self.create_team(organization=org, name="Team Bar")
        project.add_team(other_team)

        TeamKeyTransaction.objects.create(
            organization=org,
            project_team=ProjectTeam.objects.get(project=project, team=team),
            transaction=self.event_data["transaction"],
        )

        with self.feature(self.features):
            response = self.client.delete(
                reverse("sentry-api-0-organization-key-transactions", args=[org.slug]),
                data={
                    "project": [project.id],
                    "transaction": self.event_data["transaction"],
                    "team": [other_team.id],
                },
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data == {
            "team": [f"You do not have permission to access {other_team.name}"]
        }

    def test_delete_key_transactions(self):
        team = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team, user=self.user)
        self.project.add_team(team)

        TeamKeyTransaction.objects.create(
            organization=self.org,
            project_team=ProjectTeam.objects.get(project=self.project, team=team),
            transaction=self.event_data["transaction"],
        )

        with self.feature(self.features):
            response = self.client.delete(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.event_data["transaction"],
                    "team": [team.id],
                },
                format="json",
            )

        assert response.status_code == 204, response.content
        key_transactions = TeamKeyTransaction.objects.filter(project_team__team=team)
        assert len(key_transactions) == 0

    def test_delete_key_transaction_partially_existing_teams(self):
        team1 = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team1, user=self.user)
        self.project.add_team(team1)

        team2 = self.create_team(organization=self.org, name="Team Bar")
        self.create_team_membership(team2, user=self.user)
        self.project.add_team(team2)

        TeamKeyTransaction.objects.create(
            organization=self.org,
            project_team=ProjectTeam.objects.get(project=self.project, team=team1),
            transaction=self.event_data["transaction"],
        )

        with self.feature(self.features):
            response = self.client.delete(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.event_data["transaction"],
                    "team": [team1.id, team2.id],
                },
                format="json",
            )

        assert response.status_code == 204, response.content


class TeamKeyTransactionListTest(TeamKeyTransactionTestBase):
    def setUp(self):
        super().setUp()
        self.url = reverse("sentry-api-0-organization-key-transactions-list", args=[self.org.slug])

        self.team1 = self.create_team(organization=self.org, name="Team A")
        self.team2 = self.create_team(organization=self.org, name="Team B")
        self.team3 = self.create_team(organization=self.org, name="Team C")
        self.team4 = self.create_team(organization=self.org, name="Team D")
        self.team5 = self.create_team(organization=self.org, name="Team E")

        for team in [self.team1, self.team2, self.team3, self.team4, self.team5]:
            self.project.add_team(team)

        # only join teams 1,2,3
        for team in [self.team1, self.team2, self.team3]:
            self.create_team_membership(team, user=self.user)

        TeamKeyTransaction.objects.bulk_create(
            [
                TeamKeyTransaction(
                    organization=self.org,
                    project_team=project_team,
                    transaction=self.event_data["transaction"],
                )
                for project_team in ProjectTeam.objects.filter(
                    project=self.project, team__in=[self.team2, self.team3]
                )
            ]
            + [
                TeamKeyTransaction(
                    organization=self.org,
                    project_team=project_team,
                    transaction="other-transaction",
                )
                for project_team in ProjectTeam.objects.filter(
                    project=self.project, team__in=[self.team3, self.team4]
                )
            ]
        )

    def test_get_key_transaction_list_no_permissions(self):
        org = self.create_organization(
            owner=self.user,  # use other user as owner
            name="foo",
            flags=0,  # disable default allow_joinleave
        )
        project = self.create_project(name="baz", organization=org)

        user = self.create_user()
        self.login_as(user=user, superuser=False)

        team = self.create_team(organization=org, name="Team Foo")
        self.create_team_membership(team, user=user)
        project.add_team(team)

        other_team = self.create_team(organization=org, name="Team Bar")
        project.add_team(other_team)

        with self.feature(self.features):
            response = self.client.get(
                reverse("sentry-api-0-organization-key-transactions-list", args=[org.slug]),
                data={
                    "project": [self.project.id],
                    "team": ["myteams", other_team.id],
                },
                format="json",
            )

        assert response.status_code == 403, response.content
        assert response.data == {
            "detail": f"Error: You do not have permission to access {other_team.name}"
        }

    def test_get_key_transaction_list_my_teams(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                data={
                    "project": [self.project.id],
                    "team": ["myteams"],
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "team": str(self.team1.id),
                "count": 0,
                "keyed": [],
            },
            {
                "team": str(self.team2.id),
                "count": 1,
                "keyed": [
                    {
                        "project_id": str(self.project.id),
                        "transaction": self.event_data["transaction"],
                    },
                ],
            },
            {
                "team": str(self.team3.id),
                "count": 2,
                "keyed": [
                    {
                        "project_id": str(self.project.id),
                        "transaction": self.event_data["transaction"],
                    },
                    {"project_id": str(self.project.id), "transaction": "other-transaction"},
                ],
            },
        ]

    def test_get_key_transaction_list_other_teams(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                data={
                    "project": [self.project.id],
                    "team": [self.team4.id, self.team5.id],
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "team": str(self.team4.id),
                "count": 1,
                "keyed": [
                    {"project_id": str(self.project.id), "transaction": "other-transaction"},
                ],
            },
            {
                "team": str(self.team5.id),
                "count": 0,
                "keyed": [],
            },
        ]

    def test_get_key_transaction_list_mixed_my_and_other_teams(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                data={
                    "project": [self.project.id],
                    "team": ["myteams", self.team4.id, self.team5.id],
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "team": str(self.team1.id),
                "count": 0,
                "keyed": [],
            },
            {
                "team": str(self.team2.id),
                "count": 1,
                "keyed": [
                    {
                        "project_id": str(self.project.id),
                        "transaction": self.event_data["transaction"],
                    },
                ],
            },
            {
                "team": str(self.team3.id),
                "count": 2,
                "keyed": [
                    {
                        "project_id": str(self.project.id),
                        "transaction": self.event_data["transaction"],
                    },
                    {"project_id": str(self.project.id), "transaction": "other-transaction"},
                ],
            },
            {
                "team": str(self.team4.id),
                "count": 1,
                "keyed": [
                    {"project_id": str(self.project.id), "transaction": "other-transaction"},
                ],
            },
            {
                "team": str(self.team5.id),
                "count": 0,
                "keyed": [],
            },
        ]

    @override_pagination_limit(5)
    def test_get_key_transaction_list_pagination(self):
        user = self.create_user()
        self.login_as(user=user)
        org = self.create_organization(owner=user, name="foo")
        project = self.create_project(name="baz", organization=org)

        teams = []
        for i in range(8):
            team = self.create_team(organization=org, name=f"Team {i:02d}")
            self.create_team_membership(team, user=user)
            project.add_team(team)
            teams.append(team)

        # get the first page
        with self.feature(self.features):
            response = self.client.get(
                reverse("sentry-api-0-organization-key-transactions-list", args=[org.slug]),
                data={
                    "project": [str(project.id)],
                    "team": ["myteams"],
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        assert len(response.data) == 5
        links = {
            link["rel"]: {"url": url, **link}
            for url, link in parse_link_header(response["Link"]).items()
        }
        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "true"

        # get the second page
        with self.feature(self.features):
            assert links["next"]["cursor"] is not None
            response = self.client.get(
                reverse("sentry-api-0-organization-key-transactions-list", args=[org.slug]),
                data={
                    "project": [str(project.id)],
                    "team": ["myteams"],
                    "cursor": links["next"]["cursor"],
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        links = {
            link["rel"]: {"url": url, **link}
            for url, link in parse_link_header(response["Link"]).items()
        }
        assert links["previous"]["results"] == "true"
        assert links["next"]["results"] == "false"

    def test_get_key_transaction_list_partial_project(self):
        another_project = self.create_project(organization=self.org)
        another_project.add_team(self.team2)

        TeamKeyTransaction.objects.create(
            organization=self.org,
            project_team=ProjectTeam.objects.get(project=another_project, team=self.team2),
            transaction="another-transaction",
        )

        with self.feature(self.features):
            response = self.client.get(
                self.url,
                data={
                    "project": [another_project.id],
                    "team": [self.team2.id],
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "team": str(self.team2.id),
                # the key transaction in self.project is counted but not in
                # the list because self.project is not in the project param
                "count": 2,
                "keyed": [
                    {
                        "project_id": str(another_project.id),
                        "transaction": "another-transaction",
                    },
                ],
            },
        ]
