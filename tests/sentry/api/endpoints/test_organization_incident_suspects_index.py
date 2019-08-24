from __future__ import absolute_import

from exam import fixture

from sentry.api.serializers import serialize
from sentry.api.serializers.models.commit import CommitSerializer
from sentry.incidents.models import IncidentSuspectCommit
from sentry.models import Commit, Repository
from sentry.testutils import APITestCase


class OrganizationIncidentSuspectsListEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-incident-suspect-index"
    method = "get"

    @fixture
    def organization(self):
        return self.create_organization()

    @fixture
    def project(self):
        return self.create_project(organization=self.organization)

    @fixture
    def user(self):
        return self.create_user()

    def test_simple(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        release = self.create_release(project=self.project, version="v12")

        self.repo = Repository.objects.create(
            organization_id=self.organization.id, name=self.organization.id
        )
        commit_id = "a" * 40
        release.set_commits(
            [
                {
                    "id": commit_id,
                    "repository": self.repo.name,
                    "author_email": "bob@example.com",
                    "author_name": "Bob",
                    "message": "i fixed a bug",
                    "patch_set": [{"path": "src/sentry/models/release.py", "type": "M"}],
                }
            ]
        )
        incident = self.create_incident(self.organization)
        commit = Commit.objects.get(releasecommit__release=release)
        IncidentSuspectCommit.objects.create(incident=incident, commit=commit, order=1)

        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(self.organization.slug, incident.identifier)
        assert len(resp.data) == 1
        suspect = resp.data[0]
        assert suspect["type"] == "commit"
        assert suspect["data"] == serialize(commit, self.user, serializer=CommitSerializer())

    def test_access(self):
        other_user = self.create_user()
        self.login_as(other_user)
        other_team = self.create_team()
        self.create_member(
            user=self.user, organization=self.organization, role="member", teams=[self.team]
        )
        other_project = self.create_project(teams=[other_team])
        incident = self.create_incident(projects=[other_project])
        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, incident.identifier)
            assert resp.status_code == 403
