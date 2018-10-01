from __future__ import absolute_import

from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.models import Group, ReleaseCommit, Repository, Deploy
from rest_framework.response import Response


class ProjectReleaseSetupEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission, )

    def get(self, request, project):
        """
        Get list with release setup progress for a project
        1. tag an error
        2. link a repo
        3. associate commits
        4. tell sentry about a deploy
        """

        tag = Group.objects.filter(
            project=project.id,
            first_release__isnull=False,
        ).exists()

        commit = ReleaseCommit.objects.filter(
            organization_id=project.organization_id,
            release__projects=project.id,
        ).exists()

        deploy = Deploy.objects.filter(
            organization_id=project.organization_id,
            release__projects=project.id,
        ).exists()

        repo = Repository.objects.filter(
            organization_id=project.organization_id,
        ).exists()

        return Response([
            {
                'step': 'tag',
                'complete': bool(tag),
            },
            {
                'step': 'commit',
                'complete': bool(commit),
            },
            {
                'step': 'deploy',
                'complete': bool(deploy),
            },
            {
                'step': 'repo',
                'complete': bool(repo),
            }
        ])
