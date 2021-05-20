from django.urls import reverse

from sentry.discover.models import (
    MAX_KEY_TRANSACTIONS,
    MAX_TEAM_KEY_TRANSACTIONS,
    KeyTransaction,
    TeamKeyTransaction,
)
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.samples import load_data


class TeamKeyTransactionTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()

        self.login_as(user=self.user, superuser=False)
        self.org = self.create_organization(owner=self.user, name="foo")
        self.project = self.create_project(name="baz", organization=self.org)
        self.event_data = load_data("transaction")

        self.url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
        self.base_features = ["organizations:performance-view"]
        self.features = self.base_features + ["organizations:team-key-transactions"]

    def test_get_no_team_key_transaction_feature(self):
        with self.feature(self.base_features):
            response = self.client.get(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.event_data["transaction"],
                },
                format="json",
            )
        assert response.status_code == 404

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
        assert response.status_code == 400
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
        assert response.status_code == 400
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
        assert response.status_code == 200
        assert response.data == []

    def test_get_key_transaction(self):
        team1 = self.create_team(organization=self.org, name="Team A")
        team2 = self.create_team(organization=self.org, name="Team B")
        team3 = self.create_team(organization=self.org, name="Team C")
        # should not be in response because we never joined this team
        self.create_team(organization=self.org, name="Team D")

        # only join teams 1,2,3
        for team in [team1, team2, team3]:
            self.create_team_membership(team, user=self.user)
            self.project.add_team(team)

        for team in [team1, team2]:
            TeamKeyTransaction.objects.create(
                team=team,
                organization=self.org,
                transaction=self.event_data["transaction"],
                project=self.project,
            )

        with self.feature(self.features):
            response = self.client.get(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.event_data["transaction"],
                },
                format="json",
            )

        assert response.status_code == 200
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

        assert response.status_code == 400
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

        assert response.status_code == 400
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

        assert response.status_code == 400
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

        assert response.status_code == 400
        assert response.data == {
            "team": [f"You do not have permission to access {other_team.name}"]
        }

    def test_post_key_transactions_exceed_limit(self):
        team = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team, user=self.user)
        self.project.add_team(team)

        TeamKeyTransaction.objects.bulk_create(
            [
                TeamKeyTransaction(
                    team=team,
                    organization=self.org,
                    transaction=f"{self.event_data['transaction']}-{i}",
                    project=self.project,
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

        assert response.status_code == 400
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

        TeamKeyTransaction.objects.bulk_create(
            [
                TeamKeyTransaction(
                    team=team,
                    organization=self.org,
                    transaction=f"{self.event_data['transaction']}-{i}",
                    project=self.project,
                )
                for team in [team1, team2]
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

        assert response.status_code == 201
        key_transactions = TeamKeyTransaction.objects.filter(team__in=[team1, team2])
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

        assert response.status_code == 201
        key_transactions = TeamKeyTransaction.objects.filter(team=team)
        assert len(key_transactions) == 1

    def test_post_key_transactions_duplicate(self):
        team = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team, user=self.user)
        self.project.add_team(team)

        TeamKeyTransaction.objects.create(
            team=team,
            organization=self.org,
            transaction=self.event_data["transaction"],
            project=self.project,
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

        assert response.status_code == 204
        key_transactions = TeamKeyTransaction.objects.filter(
            project_id=self.project.id, transaction=self.event_data["transaction"], team_id=team.id
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

        assert response.status_code == 201
        key_transactions = TeamKeyTransaction.objects.filter(
            project_id=self.project.id,
            transaction=self.event_data["transaction"],
            team_id__in=[team1.id, team2.id],
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
            team=team1,
            organization=self.org,
            transaction=self.event_data["transaction"],
            project=self.project,
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

        assert response.status_code == 201
        key_transactions = TeamKeyTransaction.objects.filter(
            project_id=self.project.id,
            transaction=self.event_data["transaction"],
            team_id__in=[team1.id, team2.id],
        )
        assert len(key_transactions) == 2

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

        assert response.status_code == 400
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

        assert response.status_code == 400
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

        assert response.status_code == 204
        key_transactions = TeamKeyTransaction.objects.filter(team=team)
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
            team=other_team,
            organization=org,
            transaction=self.event_data["transaction"],
            project=project,
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

        assert response.status_code == 400
        assert response.data == {
            "team": [f"You do not have permission to access {other_team.name}"]
        }

    def test_delete_key_transactions(self):
        team = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team, user=self.user)
        self.project.add_team(team)

        TeamKeyTransaction.objects.create(
            team=team,
            organization=self.org,
            transaction=self.event_data["transaction"],
            project=self.project,
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

        assert response.status_code == 204
        key_transactions = TeamKeyTransaction.objects.filter(team=team)
        assert len(key_transactions) == 0

    def test_delete_key_transaction_partially_existing_teams(self):
        team1 = self.create_team(organization=self.org, name="Team Foo")
        self.create_team_membership(team1, user=self.user)
        self.project.add_team(team1)

        team2 = self.create_team(organization=self.org, name="Team Bar")
        self.create_team_membership(team2, user=self.user)
        self.project.add_team(team2)

        TeamKeyTransaction.objects.create(
            team=team1,
            organization=self.org,
            transaction=self.event_data["transaction"],
            project=self.project,
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

        assert response.status_code == 204


class KeyTransactionTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()

        self.login_as(user=self.user, superuser=False)

        self.org = self.create_organization(owner=self.user, name="foo")

        self.project = self.create_project(name="bar", organization=self.org)

    def test_save_key_transaction_as_member(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member")
        self.login_as(user=user, superuser=False)

        data = load_data("transaction")
        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.post(
                url + f"?project={self.project.id}", {"transaction": data["transaction"]}
            )
        assert response.status_code == 201

        key_transactions = KeyTransaction.objects.filter(owner=user)
        assert len(key_transactions) == 1

    def test_save_key_transaction(self):
        data = load_data("transaction")
        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.post(
                url + f"?project={self.project.id}", {"transaction": data["transaction"]}
            )

        assert response.status_code == 201

        key_transactions = KeyTransaction.objects.filter(owner=self.user)
        assert len(key_transactions) == 1

        key_transaction = key_transactions.first()
        assert key_transaction.transaction == data["transaction"]
        assert key_transaction.organization == self.org

    def test_multiple_user_save(self):
        data = load_data("transaction")
        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.post(
                url + f"?project={self.project.id}", {"transaction": data["transaction"]}
            )

        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member")

        self.login_as(user=user, superuser=False)
        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.post(
                url + f"?project={self.project.id}", {"transaction": data["transaction"]}
            )
        assert response.status_code == 201

        key_transactions = KeyTransaction.objects.filter(transaction=data["transaction"])
        assert len(key_transactions) == 2

    def test_duplicate_key_transaction(self):
        data = load_data("transaction")
        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.post(
                url + f"?project={self.project.id}", {"transaction": data["transaction"]}
            )
            assert response.status_code == 201

            response = self.client.post(
                url + f"?project={self.project.id}", {"transaction": data["transaction"]}
            )
            assert response.status_code == 204

        key_transactions = KeyTransaction.objects.filter(owner=self.user)
        assert len(key_transactions) == 1

        key_transaction = key_transactions.first()
        assert key_transaction.transaction == data["transaction"]
        assert key_transaction.organization == self.org

    def test_save_with_wrong_project(self):
        other_user = self.create_user()
        other_org = self.create_organization(owner=other_user)
        other_project = self.create_project(organization=other_org)

        data = load_data("transaction")
        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[other_org.slug])
            response = self.client.post(
                url + f"?project={other_project.id}", {"transaction": data["transaction"]}
            )

        assert response.status_code == 403

    def test_save_with_multiple_projects(self):
        other_project = self.create_project(organization=self.org)

        data = load_data("transaction")
        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.post(
                url + f"?project={other_project.id}&project={self.project.id}",
                {"transaction": data["transaction"]},
            )

        assert response.status_code == 400
        assert response.data == {"detail": "Only 1 project per Key Transaction"}

    def test_create_with_overly_long_transaction(self):
        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.post(
                url + f"?project={self.project.id}", {"transaction": "a" * 500}
            )

        assert response.status_code == 400
        assert response.data == {
            "transaction": ["Ensure this field has no more than 200 characters."]
        }

    def test_max_key_transaction(self):
        data = load_data("transaction")
        other_project = self.create_project(organization=self.org)
        for i in range(MAX_KEY_TRANSACTIONS):
            if i % 2 == 0:
                project = self.project
            else:
                project = other_project
            KeyTransaction.objects.create(
                owner=self.user,
                organization=self.org,
                transaction=data["transaction"] + str(i),
                project=project,
            )
        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.post(
                url + f"?project={self.project.id}", {"transaction": data["transaction"]}
            )

        assert response.status_code == 400
        assert response.data == {
            "non_field_errors": [f"At most {MAX_KEY_TRANSACTIONS} Key Transactions can be added"]
        }

    def test_is_key_transaction(self):
        event_data = load_data("transaction")
        start_timestamp = iso_format(before_now(minutes=1))
        end_timestamp = iso_format(before_now(minutes=1))
        event_data.update({"start_timestamp": start_timestamp, "timestamp": end_timestamp})
        KeyTransaction.objects.create(
            owner=self.user,
            organization=self.org,
            transaction=event_data["transaction"],
            project=self.project,
        )

        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-is-key-transactions", args=[self.org.slug])
            response = self.client.get(
                url, {"project": [self.project.id], "transaction": event_data["transaction"]}
            )

        assert response.status_code == 200
        assert response.data["isKey"]

    def test_is_not_key_transaction(self):
        event_data = load_data("transaction")
        start_timestamp = iso_format(before_now(minutes=1))
        end_timestamp = iso_format(before_now(minutes=1))
        event_data.update({"start_timestamp": start_timestamp, "timestamp": end_timestamp})

        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-is-key-transactions", args=[self.org.slug])
            response = self.client.get(
                url, {"project": [self.project.id], "transaction": event_data["transaction"]}
            )

        assert response.status_code == 200
        assert not response.data["isKey"]

    def test_delete_transaction(self):
        event_data = load_data("transaction")

        KeyTransaction.objects.create(
            owner=self.user,
            organization=self.org,
            transaction=event_data["transaction"],
            project=self.project,
        )
        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.delete(
                url + f"?project={self.project.id}",
                {"transaction": event_data["transaction"]},
            )

        assert response.status_code == 204
        assert (
            KeyTransaction.objects.filter(
                owner=self.user,
                organization=self.org,
                transaction=event_data["transaction"],
                project=self.project,
            ).count()
            == 0
        )

    def test_delete_transaction_with_another_user(self):
        event_data = load_data("transaction")

        KeyTransaction.objects.create(
            owner=self.user,
            organization=self.org,
            transaction=event_data["transaction"],
            project=self.project,
        )
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member")
        self.login_as(user=user, superuser=False)
        KeyTransaction.objects.create(
            owner=user,
            organization=self.org,
            transaction=event_data["transaction"],
            project=self.project,
        )
        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.delete(
                url + f"?project={self.project.id}",
                {"transaction": event_data["transaction"]},
            )

        assert response.status_code == 204
        # Original user still has a key transaction
        assert (
            KeyTransaction.objects.filter(
                owner=self.user,
                organization=self.org,
                transaction=event_data["transaction"],
                project=self.project,
            ).count()
            == 1
        )
        # Deleting user has deleted the key transaction
        assert (
            KeyTransaction.objects.filter(
                owner=user,
                organization=self.org,
                transaction=event_data["transaction"],
                project=self.project,
            ).count()
            == 0
        )

    def test_delete_key_transaction_as_member(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member")
        self.login_as(user=user, superuser=False)

        event_data = load_data("transaction")

        KeyTransaction.objects.create(
            owner=user,
            organization=self.org,
            transaction=event_data["transaction"],
            project=self.project,
        )

        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.delete(
                url + f"?project={self.project.id}",
                {"transaction": event_data["transaction"]},
            )
        assert response.status_code == 204

        key_transactions = KeyTransaction.objects.filter(owner=user)
        assert len(key_transactions) == 0

    def test_delete_nonexistent_transaction(self):
        event_data = load_data("transaction")

        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.delete(
                url + f"?project={self.project.id}",
                {"transaction": event_data["transaction"]},
            )

        assert response.status_code == 204

    def test_delete_with_multiple_projects(self):
        other_user = self.create_user()
        other_org = self.create_organization(owner=other_user)
        other_project = self.create_project(organization=other_org)

        data = load_data("transaction")
        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[other_org.slug])
            response = self.client.delete(
                url + f"?project={other_project.id}&project={self.project.id}",
                {"transaction": data["transaction"]},
            )

        assert response.status_code == 403

    def test_create_after_deleting_tenth_transaction(self):
        data = load_data("transaction")
        for i in range(MAX_KEY_TRANSACTIONS):
            KeyTransaction.objects.create(
                owner=self.user,
                organization=self.org,
                transaction=data["transaction"] + str(i),
                project=self.project,
            )

        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.delete(
                url + f"?project={self.project.id}",
                {"transaction": data["transaction"] + "0"},
            )
            assert response.status_code == 204

            response = self.client.post(
                url + f"?project={self.project.id}", {"transaction": data["transaction"]}
            )
            assert response.status_code == 201

    def test_delete_with_wrong_project(self):
        data = load_data("transaction")
        other_user = self.create_user()
        other_org = self.create_organization(owner=other_user)
        other_project = self.create_project(organization=other_org)
        KeyTransaction.objects.create(
            owner=other_user,
            organization=other_org,
            transaction=data["transaction"],
            project=other_project,
        )

        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[other_org.slug])
            response = self.client.delete(
                url + f"?project={other_project.id}", {"transaction": data["transaction"]}
            )

        assert response.status_code == 403

    def test_key_transactions_without_feature(self):
        url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
        functions = [self.client.post, self.client.delete]
        for function in functions:
            response = function(url)
            assert response.status_code == 404
        url = reverse("sentry-api-0-organization-is-key-transactions", args=[self.org.slug])
        response = self.client.get(url)
        assert response.status_code == 404
