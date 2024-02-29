from typing import Any


def get_redis_cluster_default_options(id: str) -> dict[str, Any]:
    return {
        "redis.clusters": {
            id: {
                "is_redis_cluster": True,
                "hosts": [
                    {"host": "0.0.0.0", "port": 7000},
                    {"host": "0.0.0.0", "port": 7001},
                    {"host": "0.0.0.0", "port": 7002},
                    {"host": "0.0.0.0", "port": 7003},
                    {"host": "0.0.0.0", "port": 7004},
                    {"host": "0.0.0.0", "port": 7005},
                ],
            }
        }
    }
