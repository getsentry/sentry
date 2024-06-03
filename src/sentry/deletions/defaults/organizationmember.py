from sentry.deletions.base import ModelDeletionTask, ModelRelation
from sentry.models.groupsearchview import GroupSearchView


class OrganizationMemberDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        relations = [ModelRelation(GroupSearchView, {"user_id": instance.user_id})]

        return relations
