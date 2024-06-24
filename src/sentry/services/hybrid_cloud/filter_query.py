# TODO(hybridcloud) Remove this compatibility shim after getsentry is updated
from sentry.hybridcloud.rpc.filter_query import FilterQueryDatabaseImpl, OpaqueSerializedResponse

__all__ = (
    "FilterQueryDatabaseImpl",
    "OpaqueSerializedResponse",
)
