from django.core.cache import cache
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.models import Deploy, Group, ReleaseCommit, ReleaseProject, Repository
from sentry.utils.hashlib import hash_values


class ProjectReleaseSetupCompletionEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)

    def get(self, request, project):
        """
        Get list with release setup progress for a project
        1. tag an error
        2. link a repo
        3. associate commits
        4. tell sentry about a deploy
        """

        tag_key = "onboard_tag:1:%s" % (project.id)
        repo_key = "onboard_repo:1:%s" % (project.organization_id)
        commit_key = "onboard_commit:1:%s" % hash_values([project.organization_id, project.id])
        deploy_key = "onboard_deploy:1:%s" % hash_values([project.organization_id, project.id])
        onboard_cache = cache.get_many([tag_key, repo_key, commit_key, deploy_key])

        tag = onboard_cache.get(tag_key)
        if tag is None:
            tag = Group.objects.filter(project=project.id, first_release__isnull=False).exists()
            cache.set(tag_key, tag, 3600 if tag else 60)

        repo = onboard_cache.get(repo_key)
        if repo is None:
            repo = Repository.objects.filter(organization_id=project.organization_id).exists()
            cache.set(repo_key, repo, 3600 if repo else 60)

        commit = onboard_cache.get(commit_key)
        if commit is None:
            # only get the last 1000 releases
            release_ids = (
                ReleaseProject.objects.filter(project=project.id)
                .order_by("-release_id")
                .values_list("release_id", flat=True)
            )[:1000]
            commit = ReleaseCommit.objects.filter(
                organization_id=project.organization_id, release__id__in=release_ids
            ).exists()
            cache.set(commit_key, commit, 3600 if commit else 60)

        deploy = onboard_cache.get(deploy_key)
        if deploy is None:
            deploy = Deploy.objects.filter(
                organization_id=project.organization_id, release__projects=project.id
            ).exists()
            cache.set(deploy_key, deploy, 3600 if deploy else 60)

        return Response(
            [
                {"step": "tag", "complete": bool(tag)},
                {"step": "repo", "complete": bool(repo)},
                {"step": "commit", "complete": bool(commit)},
                {"step": "deploy", "complete": bool(deploy)},
            ]
        )
