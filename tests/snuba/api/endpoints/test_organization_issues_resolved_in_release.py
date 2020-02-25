from __future__ import absolute_import

from uuid import uuid1

import six

from sentry.models import Commit, GroupLink, GroupResolution, ReleaseCommit, Repository

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.utils.compat import map


class OrganizationIssuesResolvedInReleaseEndpointTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-release-resolved"
    method = "get"

    def setUp(self):
        super(OrganizationIssuesResolvedInReleaseEndpointTest, self).setUp()
        self.user = self.create_user()
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        self.create_member(organization=self.org, user=self.user, teams=[self.team])
        self.project = self.create_project(teams=[self.team])
        self.project_2 = self.create_project(teams=[self.team])
        self.release = self.create_release(project=self.project)
        self.environment = self.create_environment(project=self.project)
        self.environment.add_project(self.project_2)
        self.environment_2 = self.create_environment(project=self.project)
        self.group = self.create_group(project=self.project)
        self.group_2 = self.create_group(project=self.project_2)
        self.login_as(self.user)

    def build_grouplink(self, group=None):
        group = self.group if group is None else group
        repo = Repository.objects.create(organization_id=self.org.id, name=group.project.name)
        commit = Commit.objects.create(
            organization_id=self.org.id, repository_id=repo.id, key=uuid1().hex
        )
        commit_2 = Commit.objects.create(
            organization_id=self.org.id, repository_id=repo.id, key=uuid1().hex
        )
        ReleaseCommit.objects.create(
            organization_id=self.org.id, release=self.release, commit=commit, order=commit.id
        )
        ReleaseCommit.objects.create(
            organization_id=self.org.id, release=self.release, commit=commit_2, order=commit_2.id
        )
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
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

    def run_test(self, expected_groups, project_ids=None, environment_names=None):
        params = {}
        if project_ids:
            params["project"] = project_ids
        if environment_names:
            params["environment"] = environment_names

        response = self.get_valid_response(self.org.slug, self.release.version, **params)
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
        new_group = self.create_group(project=self.project)
        self.build_group_resolution(new_group)
        self.run_test([self.group, new_group])

    def test_multiple_projects(self):
        """
        Test that the endpoint will return issues resolved in a release across
        projects in the org, and that filtering by project works as expected
        """
        self.build_grouplink()
        self.build_grouplink(self.group_2)
        self.run_test([self.group, self.group_2])
        self.run_test([self.group], project_ids=[self.group.project_id])
        self.run_test([self.group_2], project_ids=[self.group_2.project_id])
        self.run_test(
            [self.group, self.group_2], project_ids=[self.group.project_id, self.group_2.project_id]
        )

    def test_multiple_envs_projects(self):
        """
        Test that the endpoint will work correctly if multiple envs are passed
        """
        self.build_grouplink()
        self.build_grouplink(self.group_2)
        self.run_test(
            [self.group],
            project_ids=[self.group.project_id],
            environment_names=[self.environment.name, self.environment_2.name],
        )
