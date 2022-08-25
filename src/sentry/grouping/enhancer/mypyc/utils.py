from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Mapping,
    MutableMapping,
    Optional,
    Sequence,
    Tuple,
    TypeVar,
    cast,
)

from sentry.stacktraces.functions import get_function_name_for_frame
from sentry.stacktraces.platform import get_behavior_family_for_platform
from sentry.utils.safe import get_path

if TYPE_CHECKING:
    from .rule import Rule


FrameData = Mapping[str, Any]


ExceptionData = Mapping[str, Any]


CacheKey = Tuple[Callable[..., Any], Tuple[Any, ...], Tuple[Tuple[str, Any], ...]]

MatchingCache = MutableMapping[Tuple[Any, ...], Any]

T = TypeVar("T")


def cached(
    cache: MatchingCache,
    function: Callable[..., T],
    *args: Any,
    **kwargs: Any,
) -> T:
    """Calls ``function`` or retrieves its return value from the ``cache``.

    This is similar to ``functools.cache``, but uses a custom cache instead
    of a global one. The cache can be shared between multiple functions.
    """
    sorted_kwargs = tuple(sorted(kwargs.items()))
    key = (function, args, sorted_kwargs)

    if key in cache:
        rv = cache[key]
    else:
        rv = cache[key] = function(*args, **kwargs)

    return cast(T, rv)


def _get_function_name(frame_data: FrameData, platform: Optional[str]) -> str:

    function_name = get_function_name_for_frame(frame_data, platform)

    return function_name or "<unknown>"


class MatchFrame:
    # Use plain old class because it works well with mypyc
    def __init__(self, frame_data: FrameData, platform: Optional[str]) -> None:
        self.category = get_path(frame_data, "data", "category")
        self.family = get_behavior_family_for_platform(frame_data.get("platform") or platform)
        self.function = _get_function_name(frame_data, platform)
        self.in_app = frame_data.get("in_app")
        self.module = get_path(frame_data, "module")

        self.package = frame_data.get("package")
        if self.package:
            self.package = self.package.lower()

        self.path = frame_data.get("abs_path") or frame_data.get("filename")
        if self.path:
            self.path = self.path.lower()


# TODO: better typing
def apply_modifications_to_frame(
    modifier_rules: Sequence["Rule"],
    frames: Sequence[FrameData],
    platform: str,
    exception_data: ExceptionData,
) -> None:
    """This applies the frame modifications to the frames itself.  This
    does not affect grouping.
    """

    cache: MatchingCache = {}

    match_frames = [MatchFrame(frame, platform) for frame in frames]

    for rule in modifier_rules:
        for idx, action in rule.get_matching_frame_actions(
            match_frames, platform, exception_data, cache
        ):
            action.apply_modifications_to_frame(frames, match_frames, idx, rule=rule)
