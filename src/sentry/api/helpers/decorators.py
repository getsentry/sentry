from functools import update_wrapper

from sentry.api.base import Endpoint


class paginate:
    def __init__(self, func, paginator_cls):
        self.func = func
        self.paginator_cls = paginator_cls
        update_wrapper(self, func)

    def __set_name__(self, owner: Endpoint, name):
        self.func.class_name = owner.__name__

        setattr(owner, name, self.func)

    def __call__(self, *args, **kwargs):
        request, queryset, order_by, serialization_func = self.func(*args, **kwargs)
        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=order_by,
            on_result=serialization_func,
            paginator_cls=self.paginator_cls,
        )
