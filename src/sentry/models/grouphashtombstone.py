from __future__ import absolute_import, print_function

import logging

from django.db import models, transaction, IntegrityError
from django.utils import timezone

from sentry.models import GroupHash
from sentry.db.models import FlexibleForeignKey, Model


logger = logging.getLogger(__name__)


class GroupHashTombstone(Model):
    __core__ = True

    project = FlexibleForeignKey('sentry.Project')
    hash = models.CharField(max_length=32)
    deleted_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_grouphashtombstone'
        unique_together = (('project', 'hash'), )

    @classmethod
    def tombstone_groups(cls, project_id, group_ids):
        """\
        This method adds (or updates) a `GroupHashTombstone` for each `GroupHash`
        matching the provided groups by:

        * Fetching the `GroupHash`es for the provided set of groups
        * Updating the `deleted_at` on any existing `GroupHashTombstone`s
        * Bulk creating any missing `GroupHashTombstone`s
        * Bulk deleting the `GroupHash`es fetched at the beginning
        """

        group_hashes = list(
            GroupHash.objects.filter(
                project_id=project_id,
                group__id__in=group_ids,
            )
        )

        hashes = [gh.hash for gh in group_hashes]
        existing_tombstones = list(
            cls.objects.filter(
                project_id=project_id,
                hash__in=hashes,
            )
        )

        hashes_to_create = set(hashes)
        now = timezone.now()

        if existing_tombstones:
            cls.objects.filter(
                id__in=[et.id for et in existing_tombstones],
            ).update(
                deleted_at=now,
            )

            hashes_to_create -= set([et.hash for et in existing_tombstones])

        try:
            with transaction.atomic():
                cls.objects.bulk_create([
                    cls(
                        project_id=project_id,
                        hash=h,
                        deleted_at=now,
                    )
                    for h in hashes_to_create
                ])
        except IntegrityError:
            logger.error(
                'grouphashtombstone.tombstone_groups.integrity_error',
                extra={
                    'project_id': project_id,
                    'group_ids': group_ids,
                    'hashes': hashes_to_create,
                },
                exc_info=True
            )

        GroupHash.objects.filter(id__in=[gh.id for gh in group_hashes]).delete()
