from typing import int
from sentry.deletions.base import BaseRelation, ModelDeletionTask
from sentry.models.organizationmember import OrganizationMember


class OrganizationMemberDeletionTask(ModelDeletionTask[OrganizationMember]):
    def get_child_relations(self, instance: OrganizationMember) -> list[BaseRelation]:
        relations: list[BaseRelation] = []

        return relations
