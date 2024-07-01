from __future__ import annotations

from typing import Any, Self

from django.core import exceptions
from django.core.exceptions import EmptyResultSet
from django.db import connections, router, transaction
from django.db.models import QuerySet, sql

from sentry.db.models.manager.types import M, R
from sentry.signals import post_update


class BaseQuerySet(QuerySet[M, R]):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._with_post_update_signal = False

    def with_post_update_signal(self, enable: bool) -> Self:
        """
        Enables sending a `post_update` signal after this queryset runs an update command. Note that this is less
        efficient than just running the update. To get the list of group ids affected, we first run the query to
        fetch the rows we want to update, then run the update using those ids.
        """
        qs = self.all()
        qs._with_post_update_signal = enable
        return qs

    def _clone(self) -> Self:
        qs = super()._clone()  # type: ignore[misc]
        qs._with_post_update_signal = self._with_post_update_signal
        return qs

    def update_with_returning(self, returned_fields: list[str], **kwargs: Any) -> list[tuple[int]]:
        """
        Copied and modified from `Queryset.update()` to support `RETURNING <returned_fields>`
        """
        self._not_support_combined_queries("update")  # type: ignore[attr-defined]
        if self.query.is_sliced:
            raise TypeError("Cannot update a query once a slice has been taken.")
        self._for_write = True
        query = self.query.chain(sql.UpdateQuery)
        query.add_update_values(kwargs)  # type: ignore[attr-defined]

        # Inline annotations in order_by(), if possible.
        new_order_by = []
        for col in query.order_by:
            if annotation := query.annotations.get(col):
                if getattr(annotation, "contains_aggregate", False):
                    raise exceptions.FieldError(
                        f"Cannot update when ordering by an aggregate: {annotation}"
                    )
                new_order_by.append(annotation)
            else:
                new_order_by.append(col)
        query.order_by = tuple(new_order_by)

        # Clear any annotations so that they won't be present in subqueries.
        query.annotations = {}
        with transaction.mark_for_rollback_on_error(using=self.db):
            try:
                query_sql, query_params = query.get_compiler(self.db).as_sql()
                query_sql += f" RETURNING {', '.join(returned_fields)} "
                using = router.db_for_write(self.model)

                with connections[using].cursor() as cursor:
                    cursor.execute(query_sql, query_params)
                    result_ids = cursor.fetchall()
            except EmptyResultSet:
                # If Django detects that the query cannot return any results it'll raise
                # EmptyResultSet before we even run the query. Catch it and just return an
                # empty array of result ids
                result_ids = []

        self._result_cache = None
        return result_ids

    update_with_returning.alters_data = True  # type: ignore[attr-defined]

    def update(self, **kwargs: Any) -> int:
        if self._with_post_update_signal:
            pk = self.model._meta.pk.name
            ids = [result[0] for result in self.update_with_returning([pk], **kwargs)]
            if ids:
                updated_fields = list(kwargs.keys())
                post_update.send(sender=self.model, updated_fields=updated_fields, model_ids=ids)
            return len(ids)
        else:
            return super().update(**kwargs)

    def using_replica(self) -> Self:
        """
        Use read replica for this query. Database router is expected to use the
        `replica=True` hint to make routing decision.
        """
        return self.using(router.db_for_read(self.model, replica=True))

    def defer(self, *args: Any, **kwargs: Any) -> Self:
        raise NotImplementedError("Use ``values_list`` instead [performance].")

    def only(self, *args: Any, **kwargs: Any) -> Self:
        # In rare cases Django can use this if a field is unexpectedly deferred. This
        # mostly can happen if a field is added to a model, and then an old pickle is
        # passed to a process running the new code. So if you see this error after a
        # deploy of a model with a new field, it'll likely fix itself post-deploy.
        raise NotImplementedError("Use ``values_list`` instead [performance].")
