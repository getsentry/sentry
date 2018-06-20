from __future__ import absolute_import, print_function

from sentry import nodestore

from ..base import (BaseDeletionTask, BaseRelation, ModelDeletionTask, ModelRelation)


class NodeDeletionTask(BaseDeletionTask):
    def __init__(self, manager, nodes, **kwargs):
        self.nodes = nodes
        super(NodeDeletionTask, self).__init__(manager, **kwargs)

    def chunk(self):
        nodestore.delete_multi(self.nodes)
        return False


class EventDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry import models
        relations = super(EventDeletionTask, self).get_child_relations(instance)
        key = {'project_id': instance.project_id, 'event_id': instance.event_id}
        relations.extend([
            ModelRelation(models.EventAttachment, key),
            ModelRelation(models.EventMapping, key),
            ModelRelation(models.UserReport, key),
        ])
        return relations

    def get_child_relations_bulk(self, instance_list):
        node_ids = [i.node_data.id for i in instance_list]

        return [BaseRelation({'nodes': node_ids}, NodeDeletionTask)]
