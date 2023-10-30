from __future__ import annotations

import abc
from enum import Enum
from typing import TYPE_CHECKING, Any, Callable, Generic, List, Optional, TypeVar, Union

from django.db.models import Model, QuerySet

from sentry.services.hybrid_cloud import RpcModel
from sentry.silo import SiloMode

if TYPE_CHECKING:
    from sentry.api.serializers import Serializer
    from sentry.services.hybrid_cloud.auth import AuthenticationContext
    from sentry.services.hybrid_cloud.user import RpcUser


FILTER_ARGS = TypeVar("FILTER_ARGS")  # A typedict
RPC_RESPONSE = TypeVar("RPC_RESPONSE", bound=RpcModel)
SERIALIZER_ENUM = TypeVar("SERIALIZER_ENUM", bound=Union[Enum, None])
BASE_MODEL = TypeVar("BASE_MODEL", bound=Model)

# In the future, this ought to be a pass through type that does not get double serializer, and which cannot be
# inspected by code.
OpaqueSerializedResponse = Any


# A class that can be used to quickly provision interfaces & implementations for basic RPC Hybrid Cloud service implementations.
# It enforces several niceties:
#   * Type safety at call sites: the public API can be inferred, unknown arguments are rejected,
#     all filter arguments are optional, and nullable filters are explicitly Optional[...]
#   * Filter argument validation: an arbitrary function can be used to ensure that proper filters are applied
#     e.g. we don't want to just query for every row if no filters are passed
#   * A standard interface across most of our simple rpc services
#
# A singleton instance of a subclass can be delegated to, to add this functionality to the public interface for a service.
# E.g.
# class DatabaseBackedUserService(UserService):
#     def serialize_many(...) -> List[OpaqueSerializedResponse]:
#         return self._FQ.serialize_many(filter, as_user, auth_context, serializer)
#
#     class _UserFilterQuery(FilterQueryDatabaseImpl[User, UserFilterArgs, RpcUser, UserSerializeType]):
#        ...
#
#     _FQ = _UserFilterQuery()
class FilterQueryDatabaseImpl(
    Generic[BASE_MODEL, FILTER_ARGS, RPC_RESPONSE, SERIALIZER_ENUM], abc.ABC
):
    # Required Overrides

    @abc.abstractmethod
    def base_query(self, ids_only: bool = False) -> QuerySet[BASE_MODEL]:
        # This should return a QuerySet for the model in question along with any other required data
        # that is not a filter
        pass

    @abc.abstractmethod
    def filter_arg_validator(self) -> Callable[[FILTER_ARGS], Optional[str]]:
        # A validation function for filter arguments. Often just:
        #
        # return self._filter_has_any_key_validator( ... )
        pass

    @abc.abstractmethod
    def serialize_api(self, serializer: Optional[SERIALIZER_ENUM]) -> Serializer:
        # Returns the api serializer to use for this response.
        pass

    @abc.abstractmethod
    def apply_filters(
        self, query: QuerySet[BASE_MODEL], filters: FILTER_ARGS
    ) -> QuerySet[BASE_MODEL]:
        pass

    @abc.abstractmethod
    def serialize_rpc(self, object: BASE_MODEL) -> RPC_RESPONSE:
        pass

    # Utility Methods

    def _filter_has_any_key_validator(self, *keys: str) -> Callable[[FILTER_ARGS], Optional[str]]:
        def validator(d: FILTER_ARGS) -> Optional[str]:
            for k in keys:
                if k in d:  # type: ignore[operator]  # We assume FILTER_ARGS is a dict
                    return None

            return f"Filter must contain at least one of: {keys}"

        return validator

    # Helpers

    def _query_many(self, filter: FILTER_ARGS, ids_only: bool = False) -> QuerySet:
        validation_error = self.filter_arg_validator()(filter)
        if validation_error is not None:
            raise TypeError(
                f"Failed to validate filter arguments passed to {self.__class__.__name__}: {validation_error}"
            )

        query = self.base_query(ids_only=ids_only)
        return self.apply_filters(query, filter)

    # Public Interface

    def serialize_many(
        self,
        filter: FILTER_ARGS,
        as_user: Optional[RpcUser] = None,
        auth_context: Optional[AuthenticationContext] = None,
        serializer: Optional[SERIALIZER_ENUM] = None,
    ) -> List[OpaqueSerializedResponse]:
        from sentry.api.serializers import serialize
        from sentry.services.hybrid_cloud.user import RpcUser

        if as_user is not None and SiloMode.get_current_mode() != SiloMode.MONOLITH:
            if not isinstance(as_user, RpcUser):
                # Frequent cause of bugs that type-checking doesn't always catch
                raise TypeError("`as_user` must be serialized first")

        if as_user is None and auth_context:
            as_user = auth_context.user

        result = self._query_many(filter=filter)
        return serialize(
            list(result),
            user=as_user,
            serializer=self.serialize_api(serializer),
        )

    def get_many(self, filter: FILTER_ARGS) -> List[RPC_RESPONSE]:
        return [self.serialize_rpc(o) for o in self._query_many(filter=filter)]

    def get_many_ids(self, filter: FILTER_ARGS) -> List[int]:
        return [o.id for o in self._query_many(filter=filter, ids_only=True)]
