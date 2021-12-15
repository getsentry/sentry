from sentry.utils.services import Service


class ProjectConfigCache(Service):
    __all__ = ("set_many", "delete_many", "get")

    def __init__(self, **options):
        pass

    def set_many(self, configs):
        pass

    def delete_many(self, public_keys):
        pass

    def get(self, public_key):
        raise NotImplementedError()
