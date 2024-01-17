import abc
from typing import Any

from django.db import router
from django.db.models import QuerySet

from sentry.signals import post_update


class BaseQuerySet(QuerySet, abc.ABC):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._send_post_update_signal = False

    def enable_post_update_signal(self, enable: bool) -> "BaseQuerySet":
        """
        Enables sending a `post_update` signal after this queryset runs an update command. Note that this is less
        efficient than just running the update. To get the list of group ids affected, we first run the query to
        fetch the rows we want to update, then run the update using those ids.
        """
        qs = self.all()
        qs._send_post_update_signal = enable
        return qs

    def _clone(self) -> "BaseQuerySet":
        qs = super()._clone()  # type: ignore[misc]
        qs._send_post_update_signal = self._send_post_update_signal
        return qs

    def update(self, **kwargs: Any) -> int:
        if self._send_post_update_signal:
            ids = list(self.values_list("id", flat=True))
            updated = (
                self.model.objects.filter(id__in=ids)
                .enable_post_update_signal(False)
                .update(**kwargs)
            )
            updated_fields = list(kwargs.keys())
            post_update.send(sender=self.model, updated_fields=updated_fields, model_ids=ids)
            return updated
        else:
            return super().update(**kwargs)

    def using_replica(self) -> "BaseQuerySet":
        """
        Use read replica for this query. Database router is expected to use the
        `replica=True` hint to make routing decision.
        """
        return self.using(router.db_for_read(self.model, replica=True))

    def defer(self, *args: Any, **kwargs: Any) -> "BaseQuerySet":
        raise NotImplementedError("Use ``values_list`` instead [performance].")

    def only(self, *args: Any, **kwargs: Any) -> "BaseQuerySet":
        # In rare cases Django can use this if a field is unexpectedly deferred. This
        # mostly can happen if a field is added to a model, and then an old pickle is
        # passed to a process running the new code. So if you see this error after a
        # deploy of a model with a new field, it'll likely fix itself post-deploy.
        raise NotImplementedError("Use ``values_list`` instead [performance].")
