import sentry_sdk_alpha
from sentry_sdk_alpha.consts import OP
from sentry_sdk_alpha.integrations.redis.consts import SPAN_ORIGIN
from sentry_sdk_alpha.integrations.redis.modules.caches import (
    _compile_cache_span_properties,
    _get_cache_data,
)
from sentry_sdk_alpha.integrations.redis.modules.queries import _compile_db_span_properties
from sentry_sdk_alpha.integrations.redis.utils import (
    _create_breadcrumb,
    _get_client_data,
    _get_pipeline_data,
    _update_span,
)
from sentry_sdk_alpha.utils import capture_internal_exceptions

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Callable
    from typing import Any


def patch_redis_pipeline(
    pipeline_cls,
    is_cluster,
    get_command_args_fn,
    get_db_data_fn,
):
    # type: (Any, bool, Any, Callable[[Any], dict[str, Any]]) -> None
    old_execute = pipeline_cls.execute

    from sentry_sdk_alpha.integrations.redis import RedisIntegration

    def sentry_patched_execute(self, *args, **kwargs):
        # type: (Any, *Any, **Any) -> Any
        if sentry_sdk_alpha.get_client().get_integration(RedisIntegration) is None:
            return old_execute(self, *args, **kwargs)

        with sentry_sdk_alpha.start_span(
            op=OP.DB_REDIS,
            name="redis.pipeline.execute",
            origin=SPAN_ORIGIN,
            only_if_parent=True,
        ) as span:
            with capture_internal_exceptions():
                span_data = get_db_data_fn(self)
                pipeline_data = _get_pipeline_data(
                    is_cluster=is_cluster,
                    get_command_args_fn=get_command_args_fn,
                    is_transaction=False if is_cluster else self.transaction,
                    command_stack=self.command_stack,
                )
                _update_span(span, span_data, pipeline_data)
                _create_breadcrumb("redis.pipeline.execute", span_data, pipeline_data)

            return old_execute(self, *args, **kwargs)

    pipeline_cls.execute = sentry_patched_execute


def patch_redis_client(cls, is_cluster, get_db_data_fn):
    # type: (Any, bool, Callable[[Any], dict[str, Any]]) -> None
    """
    This function can be used to instrument custom redis client classes or
    subclasses.
    """
    old_execute_command = cls.execute_command

    from sentry_sdk_alpha.integrations.redis import RedisIntegration

    def sentry_patched_execute_command(self, name, *args, **kwargs):
        # type: (Any, str, *Any, **Any) -> Any
        integration = sentry_sdk_alpha.get_client().get_integration(RedisIntegration)
        if integration is None:
            return old_execute_command(self, name, *args, **kwargs)

        cache_properties = _compile_cache_span_properties(
            name,
            args,
            kwargs,
            integration,
        )

        cache_span = None
        if cache_properties["is_cache_key"] and cache_properties["op"] is not None:
            cache_span = sentry_sdk_alpha.start_span(
                op=cache_properties["op"],
                name=cache_properties["description"],
                origin=SPAN_ORIGIN,
                only_if_parent=True,
            )
            cache_span.__enter__()

        db_properties = _compile_db_span_properties(integration, name, args)

        db_span = sentry_sdk_alpha.start_span(
            op=db_properties["op"],
            name=db_properties["description"],
            origin=SPAN_ORIGIN,
            only_if_parent=True,
        )
        db_span.__enter__()

        db_span_data = get_db_data_fn(self)
        db_client_span_data = _get_client_data(is_cluster, name, *args)
        _update_span(db_span, db_span_data, db_client_span_data)
        _create_breadcrumb(
            db_properties["description"], db_span_data, db_client_span_data
        )

        value = old_execute_command(self, name, *args, **kwargs)

        db_span.__exit__(None, None, None)

        if cache_span:
            cache_span_data = _get_cache_data(self, cache_properties, value)
            _update_span(cache_span, cache_span_data)
            cache_span.__exit__(None, None, None)

        return value

    cls.execute_command = sentry_patched_execute_command
