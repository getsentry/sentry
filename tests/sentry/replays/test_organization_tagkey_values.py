import datetime
import uuid

from django.urls import reverse
from exam import fixture

from sentry.replays.testutils import mock_replay
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.cases import ReplaysSnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import region_silo_test


class OrganizationTagKeyTestCase(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-tagkey-values"

    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.day_ago = before_now(days=1)
        user = self.create_user()
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        self.create_member(organization=self.org, user=user, teams=[self.team])
        self.login_as(user=user)

    def get_response(self, key, **kwargs):
        return super().get_response(self.org.slug, key, **kwargs)

    def run_test(self, key, expected, **kwargs):
        response = self.get_success_response(key, **kwargs)
        assert [(val["value"], val["count"]) for val in response.data] == expected

    @fixture
    def project(self):
        return self.create_project(organization=self.org, teams=[self.team])

    @fixture
    def group(self):
        return self.create_group(project=self.project)


@region_silo_test
class OrganizationTagKeyValuesTest(OrganizationTagKeyTestCase, ReplaysSnubaTestCase):
    def test_simple(self):

        replay1_id = uuid.uuid4().hex
        replay2_id = uuid.uuid4().hex
        replay3_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        self.store_replays(
            mock_replay(
                seq1_timestamp,
                self.project.id,
                replay1_id,
                # NOTE: This is commented out due to a bug in CI.  This will not affect
                # production use and have been verfied as working as of 08/10/2022.
                #
                # error_ids=[uuid.uuid4().hex, replay1_id],  # duplicate error-id
                urls=[
                    "http://localhost:3000/",
                    "http://localhost:3000/login",
                ],  # duplicate urls are okay,
                tags={"fruit": "orange"},
                segment_id=0,
            ),
        )
        self.store_replays(
            mock_replay(
                seq1_timestamp,
                self.project.id,
                replay1_id,
                # NOTE: This is commented out due to a bug in CI.  This will not affect
                # production use and have been verfied as working as of 08/10/2022.
                #
                # error_ids=[uuid.uuid4().hex, replay1_id],  # duplicate error-id
                urls=[
                    "http://localhost:3000/",
                    "http://localhost:3000/login",
                ],  # duplicate urls are okay,
                tags={"fruit": "orange"},
                segment_id=1,
            ),
        )
        self.store_replays(
            mock_replay(
                seq1_timestamp,
                self.project.id,
                replay2_id,
                urls=[
                    "http://localhost:3000/",
                    "http://localhost:3000/login",
                ],  # duplicate urls are okay,
                tags={"fruit": "orange"},
            )
        )
        self.store_replays(
            mock_replay(
                seq1_timestamp,
                self.project.id,
                replay3_id,
                urls=[
                    "http://localhost:3000/",
                    "http://localhost:3000/login",
                ],
                tags={"fruit": "apple", "drink": "water"},
            )
        )

        url = reverse(
            "sentry-api-0-organization-tagkey-values",
            kwargs={"organization_slug": self.org.slug, "key": "fruit"},
        )
        response = self.client.get(url + "?includeReplays=1", format="json")
        assert response.status_code == 200, response.content
        assert [(val["value"], val["count"]) for val in response.data] == [
            ("orange", 2),
            ("apple", 1),
        ]
