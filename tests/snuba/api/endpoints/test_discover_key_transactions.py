from __future__ import absolute_import

import pytz
import six

from django.core.urlresolvers import reverse

from sentry.utils.compat.mock import patch
from sentry.discover.models import KeyTransaction, MAX_KEY_TRANSACTIONS
from sentry.utils.samples import load_data
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class KeyTransactionTest(APITestCase):
    def setUp(self):
        super(KeyTransactionTest, self).setUp()

        self.login_as(user=self.user, superuser=False)

        self.org = self.create_organization(owner=self.user, name="foo")

        self.project = self.create_project(name="bar", organization=self.org)

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
            assert response.status_code == 400

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
        for i in range(MAX_KEY_TRANSACTIONS):
            KeyTransaction.objects.create(
                owner=self.user,
                organization=self.org,
                transaction=data["transaction"] + six.text_type(i),
                project=self.project,
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

    @patch("django.utils.timezone.now")
    def test_get_key_transactions(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)
        project2 = self.create_project(name="foo", organization=self.org)
        event_data = load_data("transaction")
        start_timestamp = iso_format(before_now(minutes=1))
        end_timestamp = iso_format(before_now(minutes=1))
        event_data.update({"start_timestamp": start_timestamp, "timestamp": end_timestamp})

        transactions = [
            (self.project, "/foo_transaction/"),
            (self.project, "/blah_transaction/"),
            (self.project, "/zoo_transaction/"),
            (project2, "/bar_transaction/"),
        ]

        for project, transaction in transactions:
            event_data["transaction"] = transaction
            self.store_event(data=event_data, project_id=project.id)
            KeyTransaction.objects.create(
                owner=self.user,
                organization=self.org,
                transaction=event_data["transaction"],
                project=project,
            )

        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.get(
                url,
                {
                    "project": [self.project.id, project2.id],
                    "orderby": "transaction",
                    "field": [
                        "transaction",
                        "transaction_status",
                        "project",
                        "rpm()",
                        "error_rate()",
                        "percentile(transaction.duration, 0.95)",
                    ],
                },
            )

        assert response.status_code == 200
        data = response.data["data"]
        assert len(data) == 4
        assert [item["transaction"] for item in data] == [
            "/bar_transaction/",
            "/blah_transaction/",
            "/foo_transaction/",
            "/zoo_transaction/",
        ]

    @patch("django.utils.timezone.now")
    def test_get_transaction_with_quotes(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)
        start_timestamp = iso_format(before_now(minutes=1))
        end_timestamp = iso_format(before_now(minutes=1))
        event_data = load_data("transaction")
        event_data.update(
            {
                "transaction": "this is a \"transaction\" with 'quotes' \"\"to test\"\" ''what happens''",
                "start_timestamp": start_timestamp,
                "timestamp": end_timestamp,
            }
        )

        self.store_event(data=event_data, project_id=self.project.id)
        KeyTransaction.objects.create(
            owner=self.user,
            organization=self.org,
            transaction=event_data["transaction"],
            project=self.project,
        )

        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.get(
                url,
                {
                    "project": [self.project.id],
                    "orderby": "transaction",
                    "field": [
                        "transaction",
                        "transaction_status",
                        "project",
                        "rpm()",
                        "error_rate()",
                        "percentile(transaction.duration, 0.95)",
                    ],
                },
            )

        assert response.status_code == 200
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["transaction"] == event_data["transaction"]

    @patch("django.utils.timezone.now")
    def test_get_transaction_with_backslash_and_quotes(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)
        start_timestamp = iso_format(before_now(minutes=1))
        end_timestamp = iso_format(before_now(minutes=1))
        event_data = load_data("transaction")
        event_data.update(
            {
                "transaction": "\\someth\"'ing\\",
                "start_timestamp": start_timestamp,
                "timestamp": end_timestamp,
            }
        )

        self.store_event(data=event_data, project_id=self.project.id)
        KeyTransaction.objects.create(
            owner=self.user,
            organization=self.org,
            transaction=event_data["transaction"],
            project=self.project,
        )

        with self.feature("organizations:performance-view"):
            url = reverse("sentry-api-0-organization-key-transactions", args=[self.org.slug])
            response = self.client.get(
                url,
                {
                    "project": [self.project.id],
                    "orderby": "transaction",
                    "field": [
                        "transaction",
                        "transaction_status",
                        "project",
                        "rpm()",
                        "error_rate()",
                        "percentile(transaction.duration, 0.95)",
                    ],
                },
            )

        assert response.status_code == 200
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["transaction"] == event_data["transaction"]

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
