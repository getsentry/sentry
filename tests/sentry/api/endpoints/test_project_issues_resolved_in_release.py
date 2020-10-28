from __future__ import absolute_import

from uuid import uuid1

import six

from sentry.models import Commit, GroupLink, GroupResolution, ReleaseCommit, Repository

from sentry.testutils import APITestCase
from sentry.utils.compat import map


class ProjectIssuesResolvedInReleaseEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-release-resolved"
    method = "get"

    def setUp(self):
        super(ProjectIssuesResolvedInReleaseEndpointTest, self).setUp()
        self.user = self.create_user()
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        self.create_member(organization=self.org, user=self.user, teams=[self.team])
        self.project = self.create_project(teams=[self.team])
        self.release = self.create_release(project=self.project)
        self.group = self.create_group(project=self.project)
        self.login_as(self.user)

    def build_grouplink(self):
        repo = Repository.objects.create(organization_id=self.org.id, name=self.project.name)
        commit = Commit.objects.create(
            organization_id=self.org.id, repository_id=repo.id, key=uuid1().hex
        )
        commit2 = Commit.objects.create(
            organization_id=self.org.id, repository_id=repo.id, key=uuid1().hex
        )
        ReleaseCommit.objects.create(
            organization_id=self.org.id, release=self.release, commit=commit, order=1
        )
        ReleaseCommit.objects.create(
            organization_id=self.org.id, release=self.release, commit=commit2, order=0
        )
        GroupLink.objects.create(
            group_id=self.group.id,
            project_id=self.group.project_id,
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.resolves,
            linked_id=commit.id,
        )

    def build_group_resolution(self, group=None):
        return GroupResolution.objects.create(
            group=self.group if group is None else group,
            release=self.release,
            type=GroupResolution.Type.in_release,
        )

    def run_test(self, expected_groups):
        response = self.get_valid_response(self.org.slug, self.project.slug, self.release.version)
        assert len(response.data) == len(expected_groups)
        expected = set(map(six.text_type, [g.id for g in expected_groups]))
        assert set([item["id"] for item in response.data]) == expected

    def test_shows_issues_from_groupresolution(self):
        """
        tests that the endpoint will correctly retrieve issues resolved
        in a release from the GroupResolution model
        """
        self.build_group_resolution()
        self.run_test([self.group])

    def test_shows_issues_from_grouplink(self):
        """
        tests that the endpoint will correctly retrieve issues resolved
        in a release from the GroupLink model
        """
        self.build_grouplink()
        self.run_test([self.group])

    def test_does_not_return_duplicate_groups(self):
        """
        tests that the endpoint will correctly retrieve issues resolved
        in a release from the GroupLink and GroupResolution model
        but will not return the groups twice if they appear in both
        """
        self.build_grouplink()
        self.build_group_resolution()
        self.run_test([self.group])

    def test_return_groups_from_both_types(self):
        """
        tests that the endpoint will correctly retrieve issues resolved
        in a release from both the GroupLink and GroupResolution model
        """
        self.build_grouplink()
        group_2 = self.create_group(project=self.project)
        self.build_group_resolution(group_2)
        self.run_test([self.group, group_2])
