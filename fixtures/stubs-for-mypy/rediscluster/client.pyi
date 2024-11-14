from typing import TypeVar, Any, Literal, overload

from redis import Redis

T = TypeVar("T", str, bytes)

class RedisCluster(Redis[T]):
    @overload
    def __init__(
        self: RedisCluster[str],
        *,
        startup_nodes: list[dict[str, Any]],
        decode_responses: Literal[True],
        skip_full_coverage_check: bool,
        max_connections: int,
        max_connections_per_node: bool,
        readonly_mode: bool,
        **client_args: object,
    ) -> None: ...
    @overload
    def __init__(
        self: RedisCluster[bytes],
        *,
        startup_nodes: list[dict[str, Any]],
        decode_responses: Literal[False],
        skip_full_coverage_check: bool,
        max_connections: int,
        max_connections_per_node: bool,
        readonly_mode: bool,
        **client_args: object,
    ) -> None: ...
    @overload
    def __init__(
        self,
        *,
        startup_nodes: list[dict[str, Any]],
        decode_responses: bool,
        skip_full_coverage_check: bool,
        max_connections: int,
        max_connections_per_node: bool,
        readonly_mode: bool,
        **client_args: object,
    ) -> None: ...
