from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.groupsearchview import GroupSearchView
from sentry.models.organizationmember import OrganizationMember


class OrganizationMemberDeletionTask(ModelDeletionTask[OrganizationMember]):
    def get_child_relations(self, instance: OrganizationMember) -> list[BaseRelation]:
        relations: list[BaseRelation] = [
            ModelRelation(
                GroupSearchView,
                {"user_id": instance.user_id, "organization_id": instance.organization_id},
            )
        ]

        return relations
