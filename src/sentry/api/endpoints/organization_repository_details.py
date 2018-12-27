from __future__ import absolute_import

import logging

from rest_framework import serializers
from rest_framework.response import Response
from uuid import uuid4

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.models import Commit, Repository
from sentry.tasks.deletion import delete_repository

delete_logger = logging.getLogger('sentry.deletions.api')


def get_transaction_id():
    return uuid4().hex


class RepositorySerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=(
        # XXX(dcramer): these are aliased, and we prefer 'active' over 'visible'
        ('visible', 'visible'),
        ('active', 'active'),
    ))


class OrganizationRepositoryDetailsEndpoint(OrganizationEndpoint):
    doc_section = DocSection.ORGANIZATIONS

    def put(self, request, organization, repo_id):
        if not request.user.is_authenticated():
            return Response(status=401)

        try:
            repo = Repository.objects.get(
                id=repo_id,
                organization_id=organization.id,
            )
        except Repository.DoesNotExist:
            raise ResourceDoesNotExist

        if repo.status == ObjectStatus.DELETION_IN_PROGRESS:
            return Response(status=400)

        serializer = RepositorySerializer(data=request.DATA, partial=True)

        if serializer.is_valid():
            result = serializer.object
            if result.get('status'):
                if result['status'] in ('visible', 'active'):
                    repo.update(status=ObjectStatus.VISIBLE)
                else:
                    raise NotImplementedError

        return Response(serialize(repo, request.user))

    def delete(self, request, organization, repo_id):
        if not request.user.is_authenticated():
            return Response(status=401)

        try:
            repo = Repository.objects.get(
                id=repo_id,
                organization_id=organization.id,
            )
        except Repository.DoesNotExist:
            raise ResourceDoesNotExist

        updated = Repository.objects.filter(
            id=repo.id,
            status=ObjectStatus.VISIBLE,
        ).update(status=ObjectStatus.PENDING_DELETION)
        if updated:
            repo.status = ObjectStatus.PENDING_DELETION

            transaction_id = get_transaction_id()
            # if repo doesn't have commits, delete immediately
            has_commits = Commit.objects.filter(
                repository_id=repo.id,
                organization_id=organization.id,
            ).exists()

            countdown = 3600 if has_commits else 0

            delete_repository.apply_async(
                kwargs={
                    'object_id': repo.id,
                    'transaction_id': transaction_id,
                    'actor_id': request.user.id,
                },
                countdown=countdown,
            )

            delete_logger.info(
                'object.delete.queued',
                extra={
                    'object_id': repo.id,
                    'transaction_id': transaction_id,
                    'model': Repository.__name__,
                }
            )
        return Response(serialize(repo, request.user), status=202)
