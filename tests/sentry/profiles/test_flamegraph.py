from datetime import timedelta, timezone

from sentry.profiles.flamegraph import get_profiles_with_function
from sentry.testutils.cases import ProfilesSnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import region_silo_test
from sentry.utils.samples import load_data


@region_silo_test
class GetProfileWithFunctionTest(ProfilesSnubaTestCase):
    def setUp(self):
        super().setUp()

        self.now = before_now(minutes=10)
        self.hour_ago = (self.now - timedelta(hours=1)).replace(
            minute=0, second=0, microsecond=0, tzinfo=timezone.utc
        )

        for _ in range(3):
            self.store_functions(
                [
                    {
                        "self_times_ns": [100 for _ in range(10)],
                        "package": "foo",
                        "function": "foo",
                        "in_app": True,
                    },
                ],
                project=self.project,
                timestamp=self.hour_ago,
            )

        transaction = load_data("transaction", timestamp=before_now(minutes=10))
        transaction["transaction"] = "foobar"

        self.store_functions(
            [
                {
                    "self_times_ns": [100 for _ in range(10)],
                    "package": "foo",
                    "function": "foo",
                    "in_app": True,
                },
            ],
            project=self.project,
            timestamp=self.hour_ago,
            transaction=transaction,
        )

    def test_get_profile_with_function(self):
        profile_ids = get_profiles_with_function(
            self.organization.id,
            self.project.id,
            self.function_fingerprint({"package": "foo", "function": "foo"}),
            {
                "organization_id": self.organization.id,
                "project_id": [self.project.id],
                "start": before_now(days=1),
                "end": self.now,
            },
            "",
        )
        assert len(profile_ids["profile_ids"]) == 4, profile_ids

    def test_get_profile_with_function_with_transaction_filter(self):
        profile_ids = get_profiles_with_function(
            self.organization.id,
            self.project.id,
            self.function_fingerprint({"package": "foo", "function": "foo"}),
            {
                "organization_id": self.organization.id,
                "project_id": [self.project.id],
                "start": before_now(days=1),
                "end": self.now,
            },
            "transaction:foobar",
        )
        assert len(profile_ids["profile_ids"]) == 1, profile_ids

    def test_get_profile_with_function_no_match(self):
        profile_ids = get_profiles_with_function(
            self.organization.id,
            self.project.id,
            self.function_fingerprint({"package": "foo", "function": "foo"}),
            {
                "organization_id": self.organization.id,
                "project_id": [self.project.id],
                "start": before_now(days=1),
                "end": self.now,
            },
            "transaction:foo",
        )
        assert len(profile_ids["profile_ids"]) == 0, profile_ids
