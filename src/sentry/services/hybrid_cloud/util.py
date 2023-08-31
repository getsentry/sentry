from typing import Any, Callable, Iterable

from sentry.silo.base import SiloLimit, SiloMode
from sentry.utils.env import in_test_environment


def flags_to_bits(*flag_values: bool) -> int:
    bits = 0
    for (index, value) in enumerate(flag_values):
        if value:
            bits |= 1 << index
    return bits


class FunctionSiloLimit(SiloLimit):
    def handle_when_unavailable(
        self,
        original_method: Callable[..., Any],
        current_mode: SiloMode,
        available_modes: Iterable[SiloMode],
    ) -> Callable[..., Any]:
        if in_test_environment():
            mode_str = ", ".join(str(m) for m in available_modes)
            message = (
                f"Called {original_method.__name__} in "
                f"{current_mode} mode. This function is available only in: {mode_str}"
            )
            raise self.AvailabilityError(message)
        return original_method

    def __call__(self, decorated_obj: Any) -> Any:
        if not callable(decorated_obj):
            raise TypeError("`@FunctionSiloLimit` must decorate a function")
        return self.create_override(decorated_obj)


region_silo_function = FunctionSiloLimit(SiloMode.REGION)
control_silo_function = FunctionSiloLimit(SiloMode.CONTROL)
