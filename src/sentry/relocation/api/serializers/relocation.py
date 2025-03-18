import dataclasses
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

from django.contrib.auth.models import AnonymousUser
from django.db.models import QuerySet

from sentry.api.serializers import Serializer, register
from sentry.models.importchunk import BaseImportChunk, ControlImportChunkReplica, RegionImportChunk
from sentry.relocation.models.relocation import Relocation
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service


@dataclasses.dataclass(frozen=True)
class RelocationMetadata:
    """
    Some useful info to collect about a relocation when serving it.
    """

    # Maps the creator/owner's (aka "meta" users) `id`s to their respective `username`.
    meta_users: Mapping[int, RpcUser]

    # List the ids of the imported `User` models.
    imported_user_ids: list[int]

    # List the ids of the imported `Organization` models.
    imported_org_ids: list[int]


def get_all_imported_ids_of_model(chunks: QuerySet[BaseImportChunk]) -> list[int]:
    all_imported_ids = set()
    for chunk in chunks:
        all_imported_ids |= (
            set(chunk.inserted_map.values())
            | set(chunk.existing_map.values())
            | set(chunk.overwrite_map.values())
        )

    return list(all_imported_ids)


@register(Relocation)
class RelocationSerializer(Serializer):
    def serialize(
        self,
        obj: Relocation,
        attrs: Any,
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> Mapping[str, Any]:
        scheduled_at_pause_step = (
            Relocation.Step(obj.scheduled_pause_at_step).name
            if obj.scheduled_pause_at_step is not None
            else None
        )
        scheduled_at_cancel_step = (
            Relocation.Step(obj.scheduled_cancel_at_step).name
            if obj.scheduled_cancel_at_step is not None
            else None
        )
        latest_notified = (
            Relocation.EmailKind(obj.latest_notified).name
            if obj.latest_notified is not None
            else None
        )

        creator_user = attrs.meta_users.get(obj.creator_id, None)
        creator = (
            None
            if creator_user is None
            else {
                "email": creator_user.email,
                "id": str(creator_user.id),
                "username": creator_user.username,
            }
        )
        owner_user = attrs.meta_users.get(obj.owner_id, None)
        owner = (
            None
            if owner_user is None
            else {
                "email": owner_user.email,
                "id": str(owner_user.id),
                "username": owner_user.username,
            }
        )

        return {
            "dateAdded": obj.date_added,
            "dateUpdated": obj.date_updated,
            "uuid": str(obj.uuid),
            "creator": creator,
            "owner": owner,
            "status": Relocation.Status(obj.status).name,
            "step": Relocation.Step(obj.step).name,
            "provenance": Relocation.Provenance(obj.provenance).name,
            "failureReason": obj.failure_reason,
            "scheduledPauseAtStep": scheduled_at_pause_step,
            "scheduledCancelAtStep": scheduled_at_cancel_step,
            "wantOrgSlugs": obj.want_org_slugs,
            "wantUsernames": obj.want_usernames,
            "latestTask": obj.latest_task,
            "latestTaskAttempts": obj.latest_task_attempts,
            "latestNotified": latest_notified,
            "latestUnclaimedEmailsSentAt": obj.latest_unclaimed_emails_sent_at,
            "importedUserIds": attrs.imported_user_ids,
            "importedOrgIds": attrs.imported_org_ids,
        }

    def get_attrs(
        self, item_list: Sequence[Relocation], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ) -> MutableMapping[Relocation, RelocationMetadata]:
        metadata_map = {}
        for relocation in item_list:
            # Pull down the "meta" users to finish building out the `RelocationMetadata`.
            user_ids = set()
            user_ids.add(relocation.creator_id)
            user_ids.add(relocation.owner_id)
            users = user_service.get_many(filter=dict(user_ids=list(user_ids)))

            # If the Relocation has finished, we should be able to pull the imported user and org
            # pks from the correct `ControlImportChunkReplica` and `RegionImportChunk` entries,
            # respectively. If it has not yet completed the `IMPORTING` step, these will both be
            # empty.
            user_import_chunks = ControlImportChunkReplica.objects.filter(
                import_uuid=str(relocation.uuid), model="sentry.user"
            )
            org_import_chunks = RegionImportChunk.objects.filter(
                import_uuid=str(relocation.uuid), model="sentry.organization"
            )
            metadata_map[relocation] = RelocationMetadata(
                meta_users={u.id: u for u in users},
                imported_user_ids=get_all_imported_ids_of_model(user_import_chunks),
                imported_org_ids=get_all_imported_ids_of_model(org_import_chunks),
            )

        return metadata_map
