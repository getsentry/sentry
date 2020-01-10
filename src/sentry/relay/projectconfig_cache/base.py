from __future__ import absolute_import

from sentry.utils.services import Service
from sentry.relay.config import ProjectConfig


class ProjectConfigCache(Service):
    __all__ = ("set_many", "delete_many", "get")

    def __init__(self, **options):
        pass

    def set_many(self, configs):
        assert all(isinstance(config, ProjectConfig) for config in configs)

    def delete_many(self, project_ids):
        pass

    def get(self, project_id):
        raise NotImplementedError()
