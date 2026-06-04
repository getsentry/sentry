from typing import TypedDict

from django.core.cache import cache
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.deploy import Deploy
from sentry.models.group import Group
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releases.release_project import ReleaseProject
from sentry.models.repository import Repository
from sentry.utils.hashlib import hash_values


class ReleaseSetupStepResponse(TypedDict):
    # One of: tag, repo, commit, deploy.
    step: str
    complete: bool


@extend_schema(tags=["Releases"])
@cell_silo_endpoint
class ProjectReleaseSetupCompletionEndpoint(ProjectEndpoint):
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectReleasePermission,)

    @extend_schema(
        operation_id="Retrieve a Project's Release Setup Progress",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        responses={
            200: inline_sentry_response_serializer(
                "ListReleaseSetupSteps", list[ReleaseSetupStepResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, project) -> Response[list[ReleaseSetupStepResponse]]:
        """
        Return the release-setup onboarding progress for a project: whether the project
        has tagged an error, linked a repo, associated commits, and reported a deploy.
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
