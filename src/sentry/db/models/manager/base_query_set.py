import abc

from django.db import router
from django.db.models import QuerySet

from sentry.utils.types import Any


class BaseQuerySet(QuerySet, abc.ABC):  # type: ignore
    # XXX(dcramer): we prefer values_list, but we can't disable values as Django uses it
    # internally
    # def values(self, *args, **kwargs):
    #     raise NotImplementedError('Use ``values_list`` instead [performance].')

    def using_replica(self) -> "BaseQuerySet":
        """
        Use read replica for this query. Database router is expected to use the
        `replica=True` hint to make routing decision.
        """
        # Explicitly typing to satisfy mypy.
        query_set: "BaseQuerySet" = self.using(router.db_for_read(self.model, replica=True))
        return query_set

    def defer(self, *args: Any, **kwargs: Any) -> "BaseQuerySet":
        raise NotImplementedError("Use ``values_list`` instead [performance].")

    def only(self, *args: Any, **kwargs: Any) -> "BaseQuerySet":
        # In rare cases Django can use this if a field is unexpectedly deferred. This
        # mostly can happen if a field is added to a model, and then an old pickle is
        # passed to a process running the new code. So if you see this error after a
        # deploy of a model with a new field, it'll likely fix itself post-deploy.
        raise NotImplementedError("Use ``values_list`` instead [performance].")
