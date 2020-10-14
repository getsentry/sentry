from __future__ import absolute_import

import logging

from rest_framework import serializers
from rest_framework.response import Response
from uuid import uuid4
from django.db import transaction

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.models import Commit, Integration, Repository
from sentry.tasks.deletion import delete_repository

delete_logger = logging.getLogger("sentry.deletions.api")


def get_transaction_id():
    return uuid4().hex


class RepositorySerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=(
            # XXX(dcramer): these are aliased, and we prefer 'active' over 'visible'
            ("visible", "visible"),
            ("active", "active"),
        )
    )
    integrationId = EmptyIntegerField(required=False, allow_null=True)


class OrganizationRepositoryDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationIntegrationsPermission,)

    def put(self, request, organization, repo_id):
        if not request.user.is_authenticated():
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
        update_kwargs = {}
        if result.get("status"):
            if result["status"] in ("visible", "active"):
                update_kwargs["status"] = ObjectStatus.VISIBLE
            else:
                raise NotImplementedError
        if result.get("integrationId"):
            try:
                integration = Integration.objects.get(
                    id=result["integrationId"], organizations=organization
                )
            except Integration.DoesNotExist:
                return Response({"detail": "Invalid integration id"}, status=400)

            update_kwargs["integration_id"] = integration.id
            update_kwargs["provider"] = "integrations:%s" % (integration.provider,)

        if update_kwargs:
            old_status = repo.status
            with transaction.atomic():
                repo.update(**update_kwargs)
                if (
                    old_status == ObjectStatus.PENDING_DELETION
                    and repo.status == ObjectStatus.VISIBLE
                ):
                    repo.reset_pending_deletion_field_names()
                    repo.delete_pending_deletion_option()

        return Response(serialize(repo, request.user))

    def delete(self, request, organization, repo_id):
        if not request.user.is_authenticated():
            return Response(status=401)

        try:
            repo = Repository.objects.get(id=repo_id, organization_id=organization.id)
        except Repository.DoesNotExist:
            raise ResourceDoesNotExist

        updated = Repository.objects.filter(
            id=repo.id, status__in=[ObjectStatus.VISIBLE, ObjectStatus.DISABLED]
        ).update(status=ObjectStatus.PENDING_DELETION)
        if updated:
            repo.status = ObjectStatus.PENDING_DELETION

            transaction_id = get_transaction_id()
            # if repo doesn't have commits, delete immediately
            has_commits = Commit.objects.filter(
                repository_id=repo.id, organization_id=organization.id
            ).exists()

            countdown = 0 if has_commits else 0

            repo.rename_on_pending_deletion()

            delete_repository.apply_async(
                kwargs={
                    "object_id": repo.id,
                    "transaction_id": transaction_id,
                    "actor_id": request.user.id,
                },
                countdown=countdown,
            )

            delete_logger.info(
                "object.delete.queued",
                extra={
                    "object_id": repo.id,
                    "transaction_id": transaction_id,
                    "model": Repository.__name__,
                },
            )
        return Response(serialize(repo, request.user), status=202)
