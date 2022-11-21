from __future__ import annotations

import contextlib
import functools
from types import TracebackType
from typing import Any, Callable, Generator, List, Mapping, Optional, Sequence, Tuple, Type, cast

from sentry.services.hybrid_cloud import DelegatedBySiloMode, InterfaceWithLifecycle, hc_test_stub
from sentry.silo import SiloMode


class use_real_service:
    service: InterfaceWithLifecycle
    silo_mode: SiloMode | None
    context: contextlib.ExitStack

    def __init__(self, service: InterfaceWithLifecycle, silo_mode: SiloMode | None):
        self.silo_mode = silo_mode
        self.service = service
        self.context = contextlib.ExitStack()

    def __enter__(self) -> None:
        from django.test import override_settings

        if isinstance(self.service, DelegatedBySiloMode):
            if self.silo_mode is not None:
                self.context.enter_context(override_settings(SILO_MODE=self.silo_mode))
                self.context.enter_context(
                    cast(
                        Any,
                        self.service.with_replacement(None, self.silo_mode),
                    )
                )
            else:
                self.context.enter_context(
                    cast(
                        Any,
                        self.service.with_replacement(None, SiloMode.get_current_mode()),
                    )
                )
        else:
            raise ValueError("Service needs to be a DelegatedBySiloMode object, but it was not!")

    def __call__(self, f: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(f)
        def wrapped(*args: Any, **kwds: Any) -> Any:
            with use_real_service(self.service, self.silo_mode):
                return f(*args, **kwds)

        return wrapped

    def __exit__(
        self,
        __exc_type: Type[BaseException] | None,
        __exc_value: BaseException | None,
        __traceback: TracebackType | None,
    ) -> bool | None:
        return self.context.__exit__(__exc_type, __exc_value, __traceback)


@contextlib.contextmanager
def service_stubbed(
    service: InterfaceWithLifecycle,
    stub: Optional[InterfaceWithLifecycle],
    silo_mode: Optional[SiloMode] = None,
) -> Generator[None, None, None]:
    """
    Replaces a service created with silo_mode_delegation with a replacement implementation while inside of the scope,
    closing the existing implementation on enter and closing the given implementation on exit.
    """
    if silo_mode is None:
        silo_mode = SiloMode.get_current_mode()

    if isinstance(service, DelegatedBySiloMode):
        with service.with_replacement(stub, silo_mode):
            yield
    else:
        raise ValueError("Service needs to be a DelegatedBySilMode object, but it was not!")


@contextlib.contextmanager
def enforce_inter_silo_max_calls(max_calls: int) -> Generator[None, None, None]:
    call_sites: List[Tuple[Any, str, Sequence[Any], Mapping[str, Any]]] = []

    def cb(service: Any, method_name: str, *args: Sequence[Any], **kwds: Mapping[str, Any]):
        call_sites.append((service, method_name, args, kwds))
        assert (
            len(call_sites) < max_calls
        ), "Too many inter silo calls (through stubs) found!  Consider consolidating total calls."

    hc_test_stub.cb = cb
    yield
    hc_test_stub.cb = None
