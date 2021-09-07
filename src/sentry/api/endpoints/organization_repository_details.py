from django.db import transaction
from rest_framework import serializers
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.models import Commit, Integration, Repository, ScheduledDeletion


class RepositorySerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=(
            # XXX(dcramer): these are aliased, and we prefer 'active' over 'visible'
            ("visible", "visible"),
            ("active", "active"),
        )
    )
    name = serializers.CharField(required=False)
    url = serializers.URLField(required=False, allow_blank=True)
    integrationId = EmptyIntegerField(required=False, allow_null=True)


class OrganizationRepositoryDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationIntegrationsPermission,)

    def put(self, request, organization, repo_id):
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
            update_kwargs["provider"] = f"integrations:{integration.provider}"

        if (
            features.has("organizations:integrations-custom-scm", organization, actor=request.user)
            and repo.provider == "integrations:custom_scm"
        ):
            if result.get("name"):
                update_kwargs["name"] = result["name"]
            if result.get("url") is not None:
                update_kwargs["url"] = result["url"] or None

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
        if not request.user.is_authenticated:
            return Response(status=401)

        try:
            repo = Repository.objects.get(id=repo_id, organization_id=organization.id)
        except Repository.DoesNotExist:
            raise ResourceDoesNotExist

        with transaction.atomic():
            updated = Repository.objects.filter(
                id=repo.id, status__in=[ObjectStatus.VISIBLE, ObjectStatus.DISABLED]
            ).update(status=ObjectStatus.PENDING_DELETION)
            if updated:
                repo.status = ObjectStatus.PENDING_DELETION

                # if repo doesn't have commits, delete immediately
                has_commits = Commit.objects.filter(
                    repository_id=repo.id, organization_id=organization.id
                ).exists()
                repo.rename_on_pending_deletion()

                if has_commits:
                    ScheduledDeletion.schedule(repo, days=0, hours=1, actor=request.user)
                else:
                    ScheduledDeletion.schedule(repo, days=0, actor=request.user)

        return Response(serialize(repo, request.user), status=202)
