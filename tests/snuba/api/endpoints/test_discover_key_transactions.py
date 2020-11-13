from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.discover.models import KeyTransaction, MAX_KEY_TRANSACTIONS
from sentry.utils.samples import load_data
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class KeyTransactionTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(KeyTransactionTest, self).setUp()

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
                url + "?project={}".format(self.project.id), {"transaction": data["transaction"]}
            )
        assert response.status_code == 201

        key_transactions = KeyTransaction.objects.filter(owner=user)
        assert len(key_transactions) == 1

    def test_save_key_transaction(self):
        data = load_data("transaction")
        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.post(
                url + "?project={}".format(self.project.id), {"transaction": data["transaction"]}
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
                url + "?project={}".format(self.project.id), {"transaction": data["transaction"]}
            )

        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member")

        self.login_as(user=user, superuser=False)
        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.post(
                url + "?project={}".format(self.project.id), {"transaction": data["transaction"]}
            )
        assert response.status_code == 201

        key_transactions = KeyTransaction.objects.filter(transaction=data["transaction"])
        assert len(key_transactions) == 2

    def test_duplicate_key_transaction(self):
        data = load_data("transaction")
        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.post(
                url + "?project={}".format(self.project.id), {"transaction": data["transaction"]}
            )
            assert response.status_code == 201

            response = self.client.post(
                url + "?project={}".format(self.project.id), {"transaction": data["transaction"]}
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
                url + "?project={}".format(other_project.id), {"transaction": data["transaction"]}
            )

        assert response.status_code == 403

    def test_save_with_multiple_projects(self):
        other_project = self.create_project(organization=self.org)

        data = load_data("transaction")
        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.post(
                url + "?project={}&project={}".format(other_project.id, self.project.id),
                {"transaction": data["transaction"]},
            )

        assert response.status_code == 400
        assert response.data == {"detail": "Only 1 project per Key Transaction"}

    def test_create_with_overly_long_transaction(self):
        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.post(
                url + "?project={}".format(self.project.id), {"transaction": "a" * 500}
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
                transaction=data["transaction"] + six.text_type(i),
                project=project,
            )
        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.post(
                url + "?project={}".format(self.project.id), {"transaction": data["transaction"]}
            )

        assert response.status_code == 400
        assert response.data == {
            "non_field_errors": [
                "At most {} Key Transactions can be added".format(MAX_KEY_TRANSACTIONS)
            ]
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
                url + "?project={}".format(self.project.id),
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
                url + "?project={}".format(self.project.id),
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
                url + "?project={}".format(self.project.id),
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
                url + "?project={}".format(self.project.id),
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
                url + "?project={}&project={}".format(other_project.id, self.project.id),
                {"transaction": data["transaction"]},
            )

        assert response.status_code == 403

    def test_create_after_deleting_tenth_transaction(self):
        data = load_data("transaction")
        for i in range(MAX_KEY_TRANSACTIONS):
            KeyTransaction.objects.create(
                owner=self.user,
                organization=self.org,
                transaction=data["transaction"] + six.text_type(i),
                project=self.project,
            )

        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.delete(
                url + "?project={}".format(self.project.id),
                {"transaction": data["transaction"] + "0"},
            )
            assert response.status_code == 204

            response = self.client.post(
                url + "?project={}".format(self.project.id), {"transaction": data["transaction"]}
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
                url + "?project={}".format(other_project.id), {"transaction": data["transaction"]}
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
