from sentry.models.groupsearchview import GroupSearchView

from ..base import ModelDeletionTask, ModelRelation


class OrganizationMemberDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        relations = [
            ModelRelation(
                GroupSearchView,
                {"user_id": instance.user_id, "organization_id": instance.organization_id},
            )
        ]

        return relations
