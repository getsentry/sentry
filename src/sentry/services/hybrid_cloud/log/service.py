# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Optional, TypeVar, Callable, Generic, Any, Type, Union

from django.db import router, transaction
from typing_extensions import ParamSpec, Self

from sentry.db.models import BaseModel
from sentry.models import RegionOutbox
from sentry.silo import SiloMode
from sentry.utils.env import in_test_environment
from .model import AuditLogEvent, UserIpEvent

_P = ParamSpec("_P")
_R = TypeVar("_R")

class HasNative(Generic[_P, _R]):
    native: SiloMode

    def __call__(self, *args: _P.args, **kwargs: _P.kwargs) -> _R:
        pass

class ControlRpc(HasNative[_P, _R]):
    local: Callable[_P, _R]
    native = SiloMode.CONTROL

    def __init__(self, impl: Callable[_P, _R], service_key: Optional[str] = None):
        self.local = impl

    def __get__(self, instance: Any, owner: type = None) -> Self:
        return self

    def rpc(self, *args: _P.args, **kwargs: _P.kwargs) -> _R:
        pass

    @property
    def matches_silo_mode(self) -> bool:
        return SiloMode.get_current_mode() == self.native

    def __call__(self, *args: _P.args, **kwargs: _P.kwargs) -> _R:
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            return self.local(*args, **kwargs)
        return self.rpc(*args, **kwargs)

def in_transaction_with(model: Type[BaseModel]) -> bool:
    if in_test_environment():
        from sentry.testutils.hybrid_cloud import (  # NOQA:S007
            simulated_transaction_watermarks,
        )

        return (
                simulated_transaction_watermarks.connection_transaction_depth_above_watermark(
                    using=router.db_for_write(model)
                )
                > 0
        )
    else:
        return transaction.get_connection(
            router.db_for_write(model)
        ).in_atomic_block

def control_rpc(service_key: str) -> Callable[[Callable[_P, _R]], ControlRpc[_P, _R]]:
    ...

def control_rpc(impl: Callable[[Callable[_P, _R]], ControlRpc[_P, _R]]) -> ControlRpc[_P, _R]:
    ...

def control_rpc(arg: Union[str, Callable[[Callable[_P, _R]], ControlRpc[_P, _R]]]) -> Union[
    Callable[[Callable[_P, _R]], ControlRpc[_P, _R]],
    ControlRpc[_P, _R]
]:
    if callable(arg):
        return ControlRpc(arg)

    def decorator(impl: Callable[_P, _R]) -> ControlRpc[_P, _R]:
        return ControlRpc(impl, service_key=arg)
    return decorator

class LogService:
    def record_audit_log(self, *, event: AuditLogEvent) -> None:
        from .impl import record_audit_log_to_outbox, record_audit_log_to_db
        if in_transaction_with(RegionOutbox):
            return record_audit_log_to_outbox(event=event)
        return record_audit_log_to_db(event=event)

    def record_user_ip(self, *, event: UserIpEvent) -> None:
        from .impl import record_user_ip_to_outbox, record_user_ip_to_db
        if in_transaction_with(RegionOutbox):
            return record_user_ip_to_outbox(event=event)
        return record_user_ip_to_db(event=event)

    def find_last_log(
        self,
        *,
        organization_id: Optional[int],
        target_object_id: Optional[int],
        event: Optional[int],
    ) -> Optional[AuditLogEvent]:
        from .impl import find_last_log
        return find_last_log(organization_id=organization_id, target_object_id=target_object_id, event=event)

log_service = LogService()
