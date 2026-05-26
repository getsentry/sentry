from __future__ import annotations

from django.db import router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.repository import RepositorySerializer as RepositoryApiSerializer
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import CellScheduledDeletion
from sentry.models.commit import Commit
from sentry.models.organization import Organization
from sentry.models.repository import Repository


@cell_silo_endpoint
class OrganizationRepositoryDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationIntegrationsPermission,)

    def get(self, request: Request, organization: Organization, repo_id) -> Response:
        try:
            repo = Repository.objects.get(id=repo_id, organization_id=organization.id)
        except Repository.DoesNotExist:
            raise ResourceDoesNotExist

        expand = request.GET.getlist("expand", [])
        return Response(serialize(repo, request.user, RepositoryApiSerializer(expand=expand)))

    def delete(self, request: Request, organization, repo_id) -> Response:
        if not request.user.is_authenticated:
            return Response(status=401)

        try:
            repo = Repository.objects.get(id=repo_id, organization_id=organization.id)
        except Repository.DoesNotExist:
            raise ResourceDoesNotExist

        with transaction.atomic(router.db_for_write(Repository)):
            updated = Repository.objects.filter(
                id=repo.id, status__in=[ObjectStatus.ACTIVE, ObjectStatus.DISABLED]
            ).update(status=ObjectStatus.PENDING_DELETION)
            if updated:
                repo.status = ObjectStatus.PENDING_DELETION

                # if repo doesn't have commits, delete immediately
                has_commits = Commit.objects.filter(
                    repository_id=repo.id, organization_id=organization.id
                ).exists()
                repo.rename_on_pending_deletion()

                if has_commits:
                    CellScheduledDeletion.schedule(repo, days=0, hours=1, actor=request.user)
                else:
                    CellScheduledDeletion.schedule(repo, days=0, actor=request.user)

        return Response(serialize(repo, request.user), status=202)
