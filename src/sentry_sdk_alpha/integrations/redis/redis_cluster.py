"""
Instrumentation for RedisCluster
This is part of the main redis-py client.

https://github.com/redis/redis-py/blob/master/redis/cluster.py
"""

from sentry_sdk_alpha.integrations.redis._sync_common import (
    patch_redis_client,
    patch_redis_pipeline,
)
from sentry_sdk_alpha.integrations.redis.modules.queries import _get_connection_data
from sentry_sdk_alpha.integrations.redis.utils import _parse_rediscluster_command

from sentry_sdk_alpha.utils import capture_internal_exceptions

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Any
    from redis import RedisCluster
    from redis.asyncio.cluster import (
        RedisCluster as AsyncRedisCluster,
        ClusterPipeline as AsyncClusterPipeline,
    )


def _get_async_cluster_db_data(async_redis_cluster_instance):
    # type: (AsyncRedisCluster[Any]) -> dict[str, Any]
    default_node = async_redis_cluster_instance.get_default_node()
    if default_node is not None and default_node.connection_kwargs is not None:
        return _get_connection_data(default_node.connection_kwargs)
    else:
        return {}


def _get_async_cluster_pipeline_db_data(async_redis_cluster_pipeline_instance):
    # type: (AsyncClusterPipeline[Any]) -> dict[str, Any]
    with capture_internal_exceptions():
        return _get_async_cluster_db_data(
            # the AsyncClusterPipeline has always had a `_client` attr but it is private so potentially problematic and mypy
            # does not recognize it - see https://github.com/redis/redis-py/blame/v5.0.0/redis/asyncio/cluster.py#L1386
            async_redis_cluster_pipeline_instance._client,  # type: ignore[attr-defined]
        )


def _get_cluster_db_data(redis_cluster_instance):
    # type: (RedisCluster[Any]) -> dict[str, Any]
    default_node = redis_cluster_instance.get_default_node()

    if default_node is not None:
        connection_params = {
            "host": default_node.host,
            "port": default_node.port,
        }
        return _get_connection_data(connection_params)
    else:
        return {}


def _patch_redis_cluster():
    # type: () -> None
    """Patches the cluster module on redis SDK (as opposed to rediscluster library)"""
    try:
        from redis import RedisCluster, cluster
    except ImportError:
        pass
    else:
        patch_redis_client(
            RedisCluster,
            is_cluster=True,
            get_db_data_fn=_get_cluster_db_data,
        )
        patch_redis_pipeline(
            cluster.ClusterPipeline,
            is_cluster=True,
            get_command_args_fn=_parse_rediscluster_command,
            get_db_data_fn=_get_cluster_db_data,
        )

    try:
        from redis.asyncio import cluster as async_cluster
    except ImportError:
        pass
    else:
        from sentry_sdk_alpha.integrations.redis._async_common import (
            patch_redis_async_client,
            patch_redis_async_pipeline,
        )

        patch_redis_async_client(
            async_cluster.RedisCluster,
            is_cluster=True,
            get_db_data_fn=_get_async_cluster_db_data,
        )
        patch_redis_async_pipeline(
            async_cluster.ClusterPipeline,
            is_cluster=True,
            get_command_args_fn=_parse_rediscluster_command,
            get_db_data_fn=_get_async_cluster_pipeline_db_data,
        )
