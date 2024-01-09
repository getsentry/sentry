from __future__ import annotations

from typing import Any

from django.db import router, transaction
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.models.commit import Commit
from sentry.models.repository import Repository
from sentry.models.scheduledeletion import RegionScheduledDeletion
from sentry.services.hybrid_cloud import coerce_id_from
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.tasks.repository import repository_cascade_delete_on_hide


class RepositorySerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=(
            # XXX(dcramer): these are aliased, and we prefer 'active' over 'visible'
            ("visible", "visible"),
            ("active", "active"),
            ("hidden", "hidden"),
        )
    )
    name = serializers.CharField(required=False)
    url = serializers.URLField(required=False, allow_blank=True)
    integrationId = EmptyIntegerField(required=False, allow_null=True)


@region_silo_endpoint
class OrganizationRepositoryDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (OrganizationIntegrationsPermission,)

    def put(self, request: Request, organization, repo_id) -> Response:
        if not request.user.is_authenticated:
            return Response(status=401)

        try:
            repo = Repository.objects.get(id=repo_id, organization_id=organization.id)
        except Repository.DoesNotExist:
            raise ResourceDoesNotExist

        if repo.status == ObjectStatus.DELETION_IN_PROGRESS:
            return Response(status=400)

        serializer = RepositorySerializer(data=request.data, partial=True)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.validated_data
        update_kwargs: dict[str, Any] = {}
        if result.get("status"):
            if result["status"] in ("visible", "active"):
                update_kwargs["status"] = ObjectStatus.ACTIVE
            elif result["status"] == "hidden":
                update_kwargs["status"] = ObjectStatus.HIDDEN
            else:
                raise NotImplementedError
        if result.get("integrationId"):
            integration = integration_service.get_integration(
                integration_id=result["integrationId"], organization_id=coerce_id_from(organization)
            )
            if integration is None:
                return Response({"detail": "Invalid integration id"}, status=400)

            update_kwargs["integration_id"] = integration.id
            update_kwargs["provider"] = f"integrations:{integration.provider}"

        if update_kwargs:
            old_status = repo.status
            with transaction.atomic(router.db_for_write(Repository)):
                repo.update(**update_kwargs)
                if (
                    old_status == ObjectStatus.PENDING_DELETION
                    and repo.status == ObjectStatus.ACTIVE
                ):
                    repo.reset_pending_deletion_field_names()
                    repo.delete_pending_deletion_option()
                elif repo.status == ObjectStatus.HIDDEN and old_status != repo.status:
                    repository_cascade_delete_on_hide.apply_async(kwargs={"repo_id": repo.id})

        return Response(serialize(repo, request.user))

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
                    RegionScheduledDeletion.schedule(repo, days=0, hours=1, actor=request.user)
                else:
                    RegionScheduledDeletion.schedule(repo, days=0, actor=request.user)

        return Response(serialize(repo, request.user), status=202)
