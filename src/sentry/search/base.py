from sentry.utils.services import Service

ANY = object()


class SearchBackend(Service):
    __read_methods__ = frozenset(["query"])
    __write_methods__ = frozenset()
    __all__ = __read_methods__ | __write_methods__

    def __init__(self, **options):
        pass

    def query(
        self,
        projects,
        tags=None,
        environments=None,
        sort_by="date",
        limit=100,
        cursor=None,
        count_hits=False,
        paginator_options=None,
        **parameters,
    ):
        raise NotImplementedError
