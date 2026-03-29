from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.integrations.models.external_actor import ExternalActor
from sentry.models.organizationmember import OrganizationMember


class OrganizationMemberDeletionTask(ModelDeletionTask[OrganizationMember]):
    def get_child_relations(self, instance: OrganizationMember) -> list[BaseRelation]:
        relations: list[BaseRelation] = []

        if instance.user_id is not None:
            # We need to clean up external actors (user mappings for integrations),
            #  but only if the org member is not an invite.
            # This prevents us from accidentally cleaning up team mappings.
            relations.append(
                ModelRelation(
                    ExternalActor,
                    {"user_id": instance.user_id, "organization_id": instance.organization_id},
                )
            )

        return relations
