import abc
from typing import TYPE_CHECKING, Callable, Generic, List, Optional, TypeVar, Union

BASE_MODEL = TypeVar("BASE_MODEL")
FILTER_ARGS = TypeVar("FILTER_ARGS")  # A typedict
RPC_RESPONSE = TypeVar("RPC_RESPONSE")
SERIALIZER_RESPONSE = TypeVar("SERIALIZER_RESPONSE")

if TYPE_CHECKING:
    from sentry.api.serializers import Serializer
    from sentry.db.models.manager.base_query_set import BaseQuerySet
    from sentry.models.user import User
    from sentry.services.hybrid_cloud.user import APIUser


# A collection of classes that can be used to quickly provision interfaces & implementations for basic RPC Hybrid Cloud service implementations.
# It enforces several niceties:
#   * Type safety at call sites: the public API can be inferred, unknown arguments are rejected,
#     all filter arguments are optional, and nullable filters are explicitly Optional[...]
#   * Filter argument validation: an arbitrary function can be used to ensure that proper filters are applied
#     e.g. we don't want to just query for every row, so we can enforce that at least one filter key is provided
#   * A standard interface across most of our simple rpc services

# This class can be inherited from to add this functionality to the public interface for a service.
# E.g. class UserService(FilterQueryInterface[
#        UserQueryArgs, APIUser, Union[UserSerializerResponse, UserSerializerResponseSelf]
#      ], InterfaceWithLifecycle):
#         ...
class FilterQueryInterface(Generic[FILTER_ARGS, RPC_RESPONSE, SERIALIZER_RESPONSE], abc.ABC):
    @abc.abstractmethod
    def serialize_many(
        self,
        filter: FILTER_ARGS,
        as_user: Union["User", "APIUser", None] = None,
        # An API Serializer instance to render results
        serializer: Optional["Serializer"] = None,
    ) -> List[SERIALIZER_RESPONSE]:
        pass

    @abc.abstractmethod
    def get_many(self, filter: FILTER_ARGS) -> List[RPC_RESPONSE]:
        pass


class FilterQueryDatabaseImpl(
    Generic[BASE_MODEL, FILTER_ARGS, RPC_RESPONSE, SERIALIZER_RESPONSE], abc.ABC
):
    # Required Overrides

    # This should return a QuerySet for the model in question along with any other required data
    # that is not a filter
    @abc.abstractmethod
    def _base_query(self) -> "BaseQuerySet":
        pass

    @abc.abstractmethod
    def _filter_arg_validator(self) -> Callable[[FILTER_ARGS], Optional[str]]:
        pass

    @abc.abstractmethod
    def _apply_filters(self, query: "BaseQuerySet", filters: FILTER_ARGS) -> "BaseQuerySet":
        pass

    @abc.abstractmethod
    def _rpc_serialize_object(self, object: BASE_MODEL) -> RPC_RESPONSE:
        pass

    # Utility Methods

    def _filter_has_any_key_validator(self, *keys: str) -> Callable[[FILTER_ARGS], Optional[str]]:
        def validator(d: FILTER_ARGS) -> Optional[str]:
            for k in keys:
                if k in d:  # type: ignore # We assume FILTER_ARGS is a dict
                    return None

            return f"Filter must contain at least one of: {keys}"

        return validator

    # Helpers

    def _query_many(self, filter: FILTER_ARGS) -> "BaseQuerySet":
        validation_error = self._filter_arg_validator()(filter)
        if validation_error is not None:
            raise TypeError(
                f"Failed to validate filter arguments passed to {self.__class__.__name__}: {validation_error}"
            )

        query = self._base_query()
        return self._apply_filters(query, filter)

    # Public Interface

    def serialize_many(
        self,
        filter: FILTER_ARGS,
        as_user: Union["User", "APIUser", None] = None,
        # An API Serializer instance to render results
        serializer: Optional["Serializer"] = None,
    ) -> List[SERIALIZER_RESPONSE]:
        from sentry.api.serializers import serialize

        return serialize(  # type: ignore
            self._query_many(filter=filter),
            user=as_user,
            serializer=serializer,
        )

    def get_many(self, filter: FILTER_ARGS) -> List[RPC_RESPONSE]:
        return [self._rpc_serialize_object(o) for o in self._query_many(filter=filter)]


# class UserQueryArgs(TypedDict, total=False):
#     user_id: int
#     organization_id: int


# class UserService(
#     FilterQueryDatabaseImpl[
#         User, UserQueryArgs, APIUser, Union[UserSerializerResponse, UserSerializerResponseSelf]
#     ]
# ):
#     def _base_query(self) -> BaseQuerySet:
#         return User.objects

#     def _filter_arg_validator(self) -> Callable[[UserQueryArgs], Optional[str]]:
#         return self._filter_has_any_key_validator(
#             "user_ids", "organization_id", "team_ids", "project_ids", "emails"
#         )

#     def rpc_serialize_object(self, object: User) -> APIUser:
#         pass


# UserService().get_many(filter={"user_id": 2})
