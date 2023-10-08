from __future__ import annotations

from typing import Any, Callable, Generic, Mapping, Type

from django.dispatch import Signal
from typing_extensions import ParamSpec

from sentry.models import (
    ControlOutboxBase,
    OutboxCategory,
    RegionOutboxBase,
    process_control_outbox,
    process_region_outbox,
)
from sentry.services.hybrid_cloud.rpc import (
    HybridCloudArgumentException,
    HybridCloudMethodSignature,
    HybridCloudServiceSetupException,
    RpcService,
    is_rpc_method,
)
from sentry.silo import SiloMode
from sentry.utils import json

_PS = ParamSpec("_PS")


class DeferrableWithOutbox(Generic[_PS]):
    impl: Callable[_PS, None]
    category: OutboxCategory
    service: Type[RpcService] | None
    local_mode: SiloMode

    def __init__(
        self, cb: Callable[_PS, None], category: OutboxCategory, local_mode: SiloMode | None
    ):
        # this has to connect to receiver
        self.service = self._find_service(cb)
        self.method_signature = HybridCloudMethodSignature(self.service, cb)
        self.local_mode = self._extract_local_mode(cb, local_mode)
        self.category = category
        self._connect_receiver()
        self.impl = cb

    def _connect_receiver(self):
        signal: Signal = (
            process_control_outbox if self.local_mode == SiloMode.REGION else process_region_outbox
        )

        def receiver(
            payload: Mapping[str, Any] | None,
            *args: Any,
            **kwds: Any,
        ):
            try:
                arguments = self.method_signature.deserialize_arguments(payload)
            except HybridCloudArgumentException:
                return
            if self.service:
                self.impl(self.service(), **arguments.__dict__)
            else:
                self.impl(**arguments.__dict__)

        signal.connect(receiver, weak=False, sender=self.category)

    def _extract_local_mode(self, cb: Callable[..., None], local_mode: SiloMode | None) -> SiloMode:
        if self.service:
            if local_mode and local_mode != self.service.local_mode:
                raise HybridCloudServiceSetupException(
                    self.method_signature.target_name(),
                    f"deferrable_with_outbox invoked with local_mode={local_mode}, but decorating service method in local_mode={local_mode}.  Either remove the local_mode setting from the decorator, or move the implementation.",
                )
            if not is_rpc_method(cb):
                raise HybridCloudServiceSetupException(
                    self.method_signature.target_name(),
                    "deferrable_with_outbox invoked on method, but requires a @rpc_method decorator to proceed it.",
                )

            return self.service.local_mode
        else:
            if local_mode is None:
                raise HybridCloudServiceSetupException(
                    self.method_signature.target_name(),
                    "deferrable_with_outbox decorating non rpc method without local_mode.  Add local_mode= to usage.",
                )
            return local_mode

    def _find_service(self, cb: Callable[..., None]) -> Type[RpcService] | None:
        pass

    def __call__(self, object_identifier: int, shard_identifier: int, **kwargs: _PS.kwargs) -> None:
        # this one creates the outbox
        cur = SiloMode.get_current_mode()
        if cur == SiloMode.MONOLITH or cur == self.local_mode:
            if self.local_mode == SiloMode.REGION:
                obt: Type[RegionOutboxBase] = RegionOutboxBase.infer_outbox_type()
                self.category.as_region_outbox(
                    payload=json.dumps(self.method_signature.serialize_arguments(kwargs)),
                    shard_identifier=shard_identifier,
                    object_identifier=obt.next_object_identifier(),
                    outbox=obt,
                ).save()
            else:
                obt: Type[ControlOutboxBase] = ControlOutboxBase.infer_outbox_type()
                resolved = self.method_signature.resolve_to_region(kwargs)
                if resolved.region is None:
                    return

                for ob in self.category.as_control_outboxes(
                    payload=json.dumps(self.method_signature.serialize_arguments(kwargs)),
                    shard_identifier=shard_identifier,
                    object_identifier=obt.next_object_identifier(),
                    outbox=obt,
                    region_names=[resolved.region.name],
                ):
                    ob.save()
        else:
            if self.service:
                self.impl(self.service(), **kwargs)
            else:
                self.impl(**kwargs)

    def _handle_outbox(self) -> None:
        pass


def deferrable_with_outbox(
    category: OutboxCategory, local_mode: SiloMode | None
) -> Callable[[Callable[_PS, None]], DeferrableWithOutbox[_PS]]:
    def decorator(cb: Callable[_PS, None]) -> DeferrableWithOutbox[_PS]:
        return DeferrableWithOutbox(cb, category, local_mode)

    return decorator
