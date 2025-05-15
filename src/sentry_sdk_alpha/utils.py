import base64
import json
import linecache
import logging
import math
import os
import random
import re
import subprocess
import sys
import threading
import time
from collections import namedtuple
from datetime import datetime, timezone
from decimal import Decimal
from functools import partial, partialmethod, wraps
from numbers import Real
from urllib.parse import parse_qs, unquote, urlencode, urlsplit, urlunsplit

try:
    # Python 3.11
    from builtins import BaseExceptionGroup
except ImportError:
    # Python 3.10 and below
    BaseExceptionGroup = None  # type: ignore

import sentry_sdk_alpha
from sentry_sdk_alpha.consts import (
    DEFAULT_ADD_FULL_STACK,
    DEFAULT_MAX_STACK_FRAMES,
    DEFAULT_MAX_VALUE_LENGTH,
    SPANDATA,
    EndpointType,
)
from sentry_sdk_alpha._types import Annotated, AnnotatedValue, SENSITIVE_DATA_SUBSTITUTE

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from types import FrameType, TracebackType
    from typing import (
        Any,
        Callable,
        cast,
        ContextManager,
        Dict,
        Iterator,
        List,
        NoReturn,
        Optional,
        overload,
        ParamSpec,
        Set,
        Tuple,
        Type,
        TypeVar,
        Union,
    )

    from gevent.hub import Hub as GeventHub
    from opentelemetry.util.types import AttributeValue

    from sentry_sdk_alpha._types import Event, ExcInfo

    P = ParamSpec("P")
    R = TypeVar("R")


epoch = datetime(1970, 1, 1)

# The logger is created here but initialized in the debug support module
logger = logging.getLogger("sentry_sdk.errors")

_installed_modules = None

BASE64_ALPHABET = re.compile(r"^[a-zA-Z0-9/+=]*$")

FALSY_ENV_VALUES = frozenset(("false", "f", "n", "no", "off", "0"))
TRUTHY_ENV_VALUES = frozenset(("true", "t", "y", "yes", "on", "1"))

MAX_STACK_FRAMES = 2000
"""Maximum number of stack frames to send to Sentry.

If we have more than this number of stack frames, we will stop processing
the stacktrace to avoid getting stuck in a long-lasting loop. This value
exceeds the default sys.getrecursionlimit() of 1000, so users will only
be affected by this limit if they have a custom recursion limit.
"""

MAX_EXCEPTIONS = 25
"""Maximum number of exceptions in a chain or group to send to Sentry.

This is a sanity limit to avoid ending in an infinite loop of exceptions when the same exception is in the root and a leave
of the exception tree.
"""


def env_to_bool(value, *, strict=False):
    # type: (Any, Optional[bool]) -> bool | None
    """Casts an ENV variable value to boolean using the constants defined above.
    In strict mode, it may return None if the value doesn't match any of the predefined values.
    """
    normalized = str(value).lower() if value is not None else None

    if normalized in FALSY_ENV_VALUES:
        return False

    if normalized in TRUTHY_ENV_VALUES:
        return True

    return None if strict else bool(value)


def json_dumps(data):
    # type: (Any) -> bytes
    """Serialize data into a compact JSON representation encoded as UTF-8."""
    return json.dumps(data, allow_nan=False, separators=(",", ":")).encode("utf-8")


def get_git_revision():
    # type: () -> Optional[str]
    try:
        with open(os.path.devnull, "w+") as null:
            # prevent command prompt windows from popping up on windows
            startupinfo = None
            if sys.platform == "win32" or sys.platform == "cygwin":
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

            revision = (
                subprocess.Popen(
                    ["git", "rev-parse", "HEAD"],
                    startupinfo=startupinfo,
                    stdout=subprocess.PIPE,
                    stderr=null,
                    stdin=null,
                )
                .communicate()[0]
                .strip()
                .decode("utf-8")
            )
    except (OSError, IOError, FileNotFoundError):
        return None

    return revision


def get_default_release():
    # type: () -> Optional[str]
    """Try to guess a default release."""
    release = os.environ.get("SENTRY_RELEASE")
    if release:
        return release

    release = get_git_revision()
    if release:
        return release

    for var in (
        "HEROKU_SLUG_COMMIT",
        "SOURCE_VERSION",
        "CODEBUILD_RESOLVED_SOURCE_VERSION",
        "CIRCLE_SHA1",
        "GAE_DEPLOYMENT_ID",
    ):
        release = os.environ.get(var)
        if release:
            return release
    return None


def get_sdk_name(installed_integrations):
    # type: (List[str]) -> str
    """Return the SDK name including the name of the used web framework."""

    # Note: I can not use for example sentry_sdk.integrations.django.DjangoIntegration.identifier
    # here because if django is not installed the integration is not accessible.
    framework_integrations = [
        "django",
        "flask",
        "fastapi",
        "bottle",
        "falcon",
        "quart",
        "sanic",
        "starlette",
        "litestar",
        "starlite",
        "chalice",
        "serverless",
        "pyramid",
        "tornado",
        "aiohttp",
        "aws_lambda",
        "gcp",
        "beam",
        "asgi",
        "wsgi",
    ]

    for integration in framework_integrations:
        if integration in installed_integrations:
            return "sentry.python.{}".format(integration)

    return "sentry.python"


class CaptureInternalException:
    __slots__ = ()

    def __enter__(self):
        # type: () -> ContextManager[Any]
        return self

    def __exit__(self, ty, value, tb):
        # type: (Optional[Type[BaseException]], Optional[BaseException], Optional[TracebackType]) -> bool
        if ty is not None and value is not None:
            capture_internal_exception((ty, value, tb))

        return True


_CAPTURE_INTERNAL_EXCEPTION = CaptureInternalException()


def capture_internal_exceptions():
    # type: () -> ContextManager[Any]
    return _CAPTURE_INTERNAL_EXCEPTION


def capture_internal_exception(exc_info):
    # type: (ExcInfo) -> None
    """
    Capture an exception that is likely caused by a bug in the SDK
    itself.

    These exceptions do not end up in Sentry and are just logged instead.
    """
    if sentry_sdk_alpha.get_client().is_active():
        logger.error("Internal error in sentry_sdk", exc_info=exc_info)


def to_timestamp(value):
    # type: (datetime) -> float
    return (value - epoch).total_seconds()


def format_timestamp(value):
    # type: (datetime) -> str
    """Formats a timestamp in RFC 3339 format.

    Any datetime objects with a non-UTC timezone are converted to UTC, so that all timestamps are formatted in UTC.
    """
    utctime = value.astimezone(timezone.utc)

    # We use this custom formatting rather than isoformat for backwards compatibility (we have used this format for
    # several years now), and isoformat is slightly different.
    return utctime.strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def event_hint_with_exc_info(exc_info=None):
    # type: (Optional[ExcInfo]) -> Dict[str, Optional[ExcInfo]]
    """Creates a hint with the exc info filled in."""
    if exc_info is None:
        exc_info = sys.exc_info()
    else:
        exc_info = exc_info_from_error(exc_info)
    if exc_info[0] is None:
        exc_info = None
    return {"exc_info": exc_info}


class BadDsn(ValueError):
    """Raised on invalid DSNs."""


class Dsn:
    """Represents a DSN."""

    def __init__(self, value):
        # type: (Union[Dsn, str]) -> None
        if isinstance(value, Dsn):
            self.__dict__ = dict(value.__dict__)
            return
        parts = urlsplit(str(value))

        if parts.scheme not in ("http", "https"):
            raise BadDsn("Unsupported scheme %r" % parts.scheme)
        self.scheme = parts.scheme

        if parts.hostname is None:
            raise BadDsn("Missing hostname")

        self.host = parts.hostname

        if parts.port is None:
            self.port = self.scheme == "https" and 443 or 80  # type: int
        else:
            self.port = parts.port

        if not parts.username:
            raise BadDsn("Missing public key")

        self.public_key = parts.username
        self.secret_key = parts.password

        path = parts.path.rsplit("/", 1)

        try:
            self.project_id = str(int(path.pop()))
        except (ValueError, TypeError):
            raise BadDsn("Invalid project in DSN (%r)" % (parts.path or "")[1:])

        self.path = "/".join(path) + "/"

    @property
    def netloc(self):
        # type: () -> str
        """The netloc part of a DSN."""
        rv = self.host
        if (self.scheme, self.port) not in (("http", 80), ("https", 443)):
            rv = "%s:%s" % (rv, self.port)
        return rv

    def to_auth(self, client=None):
        # type: (Optional[Any]) -> Auth
        """Returns the auth info object for this dsn."""
        return Auth(
            scheme=self.scheme,
            host=self.netloc,
            path=self.path,
            project_id=self.project_id,
            public_key=self.public_key,
            secret_key=self.secret_key,
            client=client,
        )

    def __str__(self):
        # type: () -> str
        return "%s://%s%s@%s%s%s" % (
            self.scheme,
            self.public_key,
            self.secret_key and "@" + self.secret_key or "",
            self.netloc,
            self.path,
            self.project_id,
        )


class Auth:
    """Helper object that represents the auth info."""

    def __init__(
        self,
        scheme,
        host,
        project_id,
        public_key,
        secret_key=None,
        version=7,
        client=None,
        path="/",
    ):
        # type: (str, str, str, str, Optional[str], int, Optional[Any], str) -> None
        self.scheme = scheme
        self.host = host
        self.path = path
        self.project_id = project_id
        self.public_key = public_key
        self.secret_key = secret_key
        self.version = version
        self.client = client

    def get_api_url(
        self, type=EndpointType.ENVELOPE  # type: EndpointType
    ):
        # type: (...) -> str
        """Returns the API url for storing events."""
        return "%s://%s%sapi/%s/%s/" % (
            self.scheme,
            self.host,
            self.path,
            self.project_id,
            type.value,
        )

    def to_header(self):
        # type: () -> str
        """Returns the auth header a string."""
        rv = [("sentry_key", self.public_key), ("sentry_version", self.version)]
        if self.client is not None:
            rv.append(("sentry_client", self.client))
        if self.secret_key is not None:
            rv.append(("sentry_secret", self.secret_key))
        return "Sentry " + ", ".join("%s=%s" % (key, value) for key, value in rv)


def get_type_name(cls):
    # type: (Optional[type]) -> Optional[str]
    return getattr(cls, "__qualname__", None) or getattr(cls, "__name__", None)


def get_type_module(cls):
    # type: (Optional[type]) -> Optional[str]
    mod = getattr(cls, "__module__", None)
    if mod not in (None, "builtins", "__builtins__"):
        return mod
    return None


def should_hide_frame(frame):
    # type: (FrameType) -> bool
    try:
        mod = frame.f_globals["__name__"]
        if mod.startswith("sentry_sdk."):
            return True
    except (AttributeError, KeyError):
        pass

    for flag_name in "__traceback_hide__", "__tracebackhide__":
        try:
            if frame.f_locals[flag_name]:
                return True
        except Exception:
            pass

    return False


def iter_stacks(tb):
    # type: (Optional[TracebackType]) -> Iterator[TracebackType]
    tb_ = tb  # type: Optional[TracebackType]
    while tb_ is not None:
        if not should_hide_frame(tb_.tb_frame):
            yield tb_
        tb_ = tb_.tb_next


def get_lines_from_file(
    filename,  # type: str
    lineno,  # type: int
    max_length=None,  # type: Optional[int]
    loader=None,  # type: Optional[Any]
    module=None,  # type: Optional[str]
):
    # type: (...) -> Tuple[List[Annotated[str]], Optional[Annotated[str]], List[Annotated[str]]]
    context_lines = 5
    source = None
    if loader is not None and hasattr(loader, "get_source"):
        try:
            source_str = loader.get_source(module)  # type: Optional[str]
        except (ImportError, IOError):
            source_str = None
        if source_str is not None:
            source = source_str.splitlines()

    if source is None:
        try:
            source = linecache.getlines(filename)
        except (OSError, IOError):
            return [], None, []

    if not source:
        return [], None, []

    lower_bound = max(0, lineno - context_lines)
    upper_bound = min(lineno + 1 + context_lines, len(source))

    try:
        pre_context = [
            strip_string(line.strip("\r\n"), max_length=max_length)
            for line in source[lower_bound:lineno]
        ]
        context_line = strip_string(source[lineno].strip("\r\n"), max_length=max_length)
        post_context = [
            strip_string(line.strip("\r\n"), max_length=max_length)
            for line in source[(lineno + 1) : upper_bound]
        ]
        return pre_context, context_line, post_context
    except IndexError:
        # the file may have changed since it was loaded into memory
        return [], None, []


def get_source_context(
    frame,  # type: FrameType
    tb_lineno,  # type: Optional[int]
    max_value_length=None,  # type: Optional[int]
):
    # type: (...) -> Tuple[List[Annotated[str]], Optional[Annotated[str]], List[Annotated[str]]]
    try:
        abs_path = frame.f_code.co_filename  # type: Optional[str]
    except Exception:
        abs_path = None
    try:
        module = frame.f_globals["__name__"]
    except Exception:
        return [], None, []
    try:
        loader = frame.f_globals["__loader__"]
    except Exception:
        loader = None

    if tb_lineno is not None and abs_path:
        lineno = tb_lineno - 1
        return get_lines_from_file(
            abs_path, lineno, max_value_length, loader=loader, module=module
        )

    return [], None, []


def safe_str(value):
    # type: (Any) -> str
    try:
        return str(value)
    except Exception:
        return safe_repr(value)


def safe_repr(value):
    # type: (Any) -> str
    try:
        return repr(value)
    except Exception:
        return "<broken repr>"


def filename_for_module(module, abs_path):
    # type: (Optional[str], Optional[str]) -> Optional[str]
    if not abs_path or not module:
        return abs_path

    try:
        if abs_path.endswith(".pyc"):
            abs_path = abs_path[:-1]

        base_module = module.split(".", 1)[0]
        if base_module == module:
            return os.path.basename(abs_path)

        base_module_path = sys.modules[base_module].__file__
        if not base_module_path:
            return abs_path

        return abs_path.split(base_module_path.rsplit(os.sep, 2)[0], 1)[-1].lstrip(
            os.sep
        )
    except Exception:
        return abs_path


def serialize_frame(
    frame,
    tb_lineno=None,
    include_local_variables=True,
    include_source_context=True,
    max_value_length=None,
    custom_repr=None,
):
    # type: (FrameType, Optional[int], bool, bool, Optional[int], Optional[Callable[..., Optional[str]]]) -> Dict[str, Any]
    f_code = getattr(frame, "f_code", None)
    if not f_code:
        abs_path = None
        function = None
    else:
        abs_path = frame.f_code.co_filename
        function = frame.f_code.co_name
    try:
        module = frame.f_globals["__name__"]
    except Exception:
        module = None

    if tb_lineno is None:
        tb_lineno = frame.f_lineno

    rv = {
        "filename": filename_for_module(module, abs_path) or None,
        "abs_path": os.path.abspath(abs_path) if abs_path else None,
        "function": function or "<unknown>",
        "module": module,
        "lineno": tb_lineno,
    }  # type: Dict[str, Any]

    if include_source_context:
        rv["pre_context"], rv["context_line"], rv["post_context"] = get_source_context(
            frame, tb_lineno, max_value_length
        )

    if include_local_variables:
        from sentry_sdk_alpha.serializer import serialize

        rv["vars"] = serialize(
            dict(frame.f_locals), is_vars=True, custom_repr=custom_repr
        )

    return rv


def current_stacktrace(
    include_local_variables=True,  # type: bool
    include_source_context=True,  # type: bool
    max_value_length=None,  # type: Optional[int]
):
    # type: (...) -> Dict[str, Any]
    __tracebackhide__ = True
    frames = []

    f = sys._getframe()  # type: Optional[FrameType]
    while f is not None:
        if not should_hide_frame(f):
            frames.append(
                serialize_frame(
                    f,
                    include_local_variables=include_local_variables,
                    include_source_context=include_source_context,
                    max_value_length=max_value_length,
                )
            )
        f = f.f_back

    frames.reverse()

    return {"frames": frames}


def get_errno(exc_value):
    # type: (BaseException) -> Optional[Any]
    return getattr(exc_value, "errno", None)


def get_error_message(exc_value):
    # type: (Optional[BaseException]) -> str
    message = (
        getattr(exc_value, "message", "")
        or getattr(exc_value, "detail", "")
        or safe_str(exc_value)
    )  # type: str

    # __notes__ should be a list of strings when notes are added
    # via add_note, but can be anything else if __notes__ is set
    # directly. We only support strings in __notes__, since that
    # is the correct use.
    notes = getattr(exc_value, "__notes__", None)  # type: object
    if isinstance(notes, list) and len(notes) > 0:
        message += "\n" + "\n".join(note for note in notes if isinstance(note, str))

    return message


def single_exception_from_error_tuple(
    exc_type,  # type: Optional[type]
    exc_value,  # type: Optional[BaseException]
    tb,  # type: Optional[TracebackType]
    client_options=None,  # type: Optional[Dict[str, Any]]
    mechanism=None,  # type: Optional[Dict[str, Any]]
    exception_id=None,  # type: Optional[int]
    parent_id=None,  # type: Optional[int]
    source=None,  # type: Optional[str]
    full_stack=None,  # type: Optional[list[dict[str, Any]]]
):
    # type: (...) -> Dict[str, Any]
    """
    Creates a dict that goes into the events `exception.values` list and is ingestible by Sentry.

    See the Exception Interface documentation for more details:
    https://develop.sentry.dev/sdk/event-payloads/exception/
    """
    exception_value = {}  # type: Dict[str, Any]
    exception_value["mechanism"] = (
        mechanism.copy() if mechanism else {"type": "generic", "handled": True}
    )
    if exception_id is not None:
        exception_value["mechanism"]["exception_id"] = exception_id

    if exc_value is not None:
        errno = get_errno(exc_value)
    else:
        errno = None

    if errno is not None:
        exception_value["mechanism"].setdefault("meta", {}).setdefault(
            "errno", {}
        ).setdefault("number", errno)

    if source is not None:
        exception_value["mechanism"]["source"] = source

    is_root_exception = exception_id == 0
    if not is_root_exception and parent_id is not None:
        exception_value["mechanism"]["parent_id"] = parent_id
        exception_value["mechanism"]["type"] = "chained"

    if is_root_exception and "type" not in exception_value["mechanism"]:
        exception_value["mechanism"]["type"] = "generic"

    is_exception_group = BaseExceptionGroup is not None and isinstance(
        exc_value, BaseExceptionGroup
    )
    if is_exception_group:
        exception_value["mechanism"]["is_exception_group"] = True

    exception_value["module"] = get_type_module(exc_type)
    exception_value["type"] = get_type_name(exc_type)
    exception_value["value"] = get_error_message(exc_value)

    if client_options is None:
        include_local_variables = True
        include_source_context = True
        max_value_length = DEFAULT_MAX_VALUE_LENGTH  # fallback
        custom_repr = None
    else:
        include_local_variables = client_options["include_local_variables"]
        include_source_context = client_options["include_source_context"]
        max_value_length = client_options["max_value_length"]
        custom_repr = client_options.get("custom_repr")

    frames = [
        serialize_frame(
            tb.tb_frame,
            tb_lineno=tb.tb_lineno,
            include_local_variables=include_local_variables,
            include_source_context=include_source_context,
            max_value_length=max_value_length,
            custom_repr=custom_repr,
        )
        # Process at most MAX_STACK_FRAMES + 1 frames, to avoid hanging on
        # processing a super-long stacktrace.
        for tb, _ in zip(iter_stacks(tb), range(MAX_STACK_FRAMES + 1))
    ]  # type: List[Dict[str, Any]]

    if len(frames) > MAX_STACK_FRAMES:
        # If we have more frames than the limit, we remove the stacktrace completely.
        # We don't trim the stacktrace here because we have not processed the whole
        # thing (see above, we stop at MAX_STACK_FRAMES + 1). Normally, Relay would
        # intelligently trim by removing frames in the middle of the stacktrace, but
        # since we don't have the whole stacktrace, we can't do that. Instead, we
        # drop the entire stacktrace.
        exception_value["stacktrace"] = AnnotatedValue.removed_because_over_size_limit(
            value=None
        )

    elif frames:
        if not full_stack:
            new_frames = frames
        else:
            new_frames = merge_stack_frames(frames, full_stack, client_options)

        exception_value["stacktrace"] = {"frames": new_frames}

    return exception_value


HAS_CHAINED_EXCEPTIONS = hasattr(Exception, "__suppress_context__")

if HAS_CHAINED_EXCEPTIONS:

    def walk_exception_chain(exc_info):
        # type: (ExcInfo) -> Iterator[ExcInfo]
        exc_type, exc_value, tb = exc_info

        seen_exceptions = []
        seen_exception_ids = set()  # type: Set[int]

        while (
            exc_type is not None
            and exc_value is not None
            and id(exc_value) not in seen_exception_ids
        ):
            yield exc_type, exc_value, tb

            # Avoid hashing random types we don't know anything
            # about. Use the list to keep a ref so that the `id` is
            # not used for another object.
            seen_exceptions.append(exc_value)
            seen_exception_ids.add(id(exc_value))

            if exc_value.__suppress_context__:
                cause = exc_value.__cause__
            else:
                cause = exc_value.__context__
            if cause is None:
                break
            exc_type = type(cause)
            exc_value = cause
            tb = getattr(cause, "__traceback__", None)

else:

    def walk_exception_chain(exc_info):
        # type: (ExcInfo) -> Iterator[ExcInfo]
        yield exc_info


def exceptions_from_error(
    exc_type,  # type: Optional[type]
    exc_value,  # type: Optional[BaseException]
    tb,  # type: Optional[TracebackType]
    client_options=None,  # type: Optional[Dict[str, Any]]
    mechanism=None,  # type: Optional[Dict[str, Any]]
    exception_id=0,  # type: int
    parent_id=0,  # type: int
    source=None,  # type: Optional[str]
    full_stack=None,  # type: Optional[list[dict[str, Any]]]
):
    # type: (...) -> Tuple[int, List[Dict[str, Any]]]
    """
    Converts the given exception information into the Sentry structured "exception" format.
    This will return a list of exceptions (a flattened tree of exceptions) in the
    format of the Exception Interface documentation:
    https://develop.sentry.dev/sdk/data-model/event-payloads/exception/

    This function can handle:
    - simple exceptions
    - chained exceptions (raise .. from ..)
    - exception groups
    """
    base_exception = single_exception_from_error_tuple(
        exc_type=exc_type,
        exc_value=exc_value,
        tb=tb,
        client_options=client_options,
        mechanism=mechanism,
        exception_id=exception_id,
        parent_id=parent_id,
        source=source,
        full_stack=full_stack,
    )
    exceptions = [base_exception]

    parent_id = exception_id
    exception_id += 1

    if exception_id > MAX_EXCEPTIONS - 1:
        return (exception_id, exceptions)

    causing_exception = None
    exception_source = None

    # Add any causing exceptions, if present.
    should_suppress_context = hasattr(exc_value, "__suppress_context__") and exc_value.__suppress_context__  # type: ignore
    # Note: __suppress_context__ is True if the exception is raised with the `from` keyword.
    if should_suppress_context:
        # Explicitly chained exceptions (Like: raise NewException() from OriginalException())
        # The field `__cause__` is set to OriginalException
        has_explicit_causing_exception = (
            exc_value
            and hasattr(exc_value, "__cause__")
            and exc_value.__cause__ is not None
        )
        if has_explicit_causing_exception:
            exception_source = "__cause__"
            causing_exception = exc_value.__cause__  # type: ignore
    else:
        # Implicitly chained exceptions (when an exception occurs while handling another exception)
        # The field `__context__` is set in the exception that occurs while handling another exception,
        # to the other exception.
        has_implicit_causing_exception = (
            exc_value
            and hasattr(exc_value, "__context__")
            and exc_value.__context__ is not None
        )
        if has_implicit_causing_exception:
            exception_source = "__context__"
            causing_exception = exc_value.__context__  # type: ignore

    if causing_exception:
        # Some frameworks (e.g. FastAPI) wrap the causing exception in an
        # ExceptionGroup that only contain one exception: the causing exception.
        # This would lead to an infinite loop, so we skip the causing exception
        # in this case. (because it is the same as the base_exception above)
        if (
            BaseExceptionGroup is not None
            and isinstance(causing_exception, BaseExceptionGroup)
            and len(causing_exception.exceptions) == 1
            and causing_exception.exceptions[0] == exc_value
        ):
            causing_exception = None

    if causing_exception:
        (exception_id, child_exceptions) = exceptions_from_error(
            exc_type=type(causing_exception),
            exc_value=causing_exception,
            tb=getattr(causing_exception, "__traceback__", None),
            client_options=client_options,
            mechanism=mechanism,
            exception_id=exception_id,
            parent_id=parent_id,
            source=exception_source,
            full_stack=full_stack,
        )
        exceptions.extend(child_exceptions)

    # Add child exceptions from an ExceptionGroup.
    is_exception_group = exc_value and hasattr(exc_value, "exceptions")
    if is_exception_group:
        for idx, causing_exception in enumerate(exc_value.exceptions):  # type: ignore
            (exception_id, child_exceptions) = exceptions_from_error(
                exc_type=type(causing_exception),
                exc_value=causing_exception,
                tb=getattr(causing_exception, "__traceback__", None),
                client_options=client_options,
                mechanism=mechanism,
                exception_id=exception_id,
                parent_id=parent_id,
                source="exceptions[%s]" % idx,
                full_stack=full_stack,
            )
            exceptions.extend(child_exceptions)

    return (exception_id, exceptions)


def exceptions_from_error_tuple(
    exc_info,  # type: ExcInfo
    client_options=None,  # type: Optional[Dict[str, Any]]
    mechanism=None,  # type: Optional[Dict[str, Any]]
    full_stack=None,  # type: Optional[list[dict[str, Any]]]
):
    # type: (...) -> List[Dict[str, Any]]
    """
    Convert Python's exception information into Sentry's structured "exception" format in the event.
    See https://develop.sentry.dev/sdk/data-model/event-payloads/exception/
    This is the entry point for the exception handling.
    """
    # unpack the exception info tuple
    exc_type, exc_value, tb = exc_info

    # let exceptions_from_error do the actual work
    _, exceptions = exceptions_from_error(
        exc_type=exc_type,
        exc_value=exc_value,
        tb=tb,
        client_options=client_options,
        mechanism=mechanism,
        exception_id=0,
        parent_id=0,
        full_stack=full_stack,
    )

    # make sure the exceptions are sorted
    # from the innermost (oldest)
    # to the outermost (newest) exception
    exceptions.reverse()

    return exceptions


def to_string(value):
    # type: (str) -> str
    try:
        return str(value)
    except UnicodeDecodeError:
        return repr(value)[1:-1]


def iter_event_stacktraces(event):
    # type: (Event) -> Iterator[Annotated[Dict[str, Any]]]
    if "stacktrace" in event:
        yield event["stacktrace"]
    if "threads" in event:
        for thread in event["threads"].get("values") or ():
            if "stacktrace" in thread:
                yield thread["stacktrace"]
    if "exception" in event:
        for exception in event["exception"].get("values") or ():
            if isinstance(exception, dict) and "stacktrace" in exception:
                yield exception["stacktrace"]


def iter_event_frames(event):
    # type: (Event) -> Iterator[Dict[str, Any]]
    for stacktrace in iter_event_stacktraces(event):
        if isinstance(stacktrace, AnnotatedValue):
            stacktrace = stacktrace.value or {}

        for frame in stacktrace.get("frames") or ():
            yield frame


def handle_in_app(event, in_app_exclude=None, in_app_include=None, project_root=None):
    # type: (Event, Optional[List[str]], Optional[List[str]], Optional[str]) -> Event
    for stacktrace in iter_event_stacktraces(event):
        if isinstance(stacktrace, AnnotatedValue):
            stacktrace = stacktrace.value or {}

        set_in_app_in_frames(
            stacktrace.get("frames"),
            in_app_exclude=in_app_exclude,
            in_app_include=in_app_include,
            project_root=project_root,
        )

    return event


def set_in_app_in_frames(frames, in_app_exclude, in_app_include, project_root=None):
    # type: (Any, Optional[List[str]], Optional[List[str]], Optional[str]) -> Optional[Any]
    if not frames:
        return None

    for frame in frames:
        # if frame has already been marked as in_app, skip it
        current_in_app = frame.get("in_app")
        if current_in_app is not None:
            continue

        module = frame.get("module")

        # check if module in frame is in the list of modules to include
        if _module_in_list(module, in_app_include):
            frame["in_app"] = True
            continue

        # check if module in frame is in the list of modules to exclude
        if _module_in_list(module, in_app_exclude):
            frame["in_app"] = False
            continue

        # if frame has no abs_path, skip further checks
        abs_path = frame.get("abs_path")
        if abs_path is None:
            continue

        if _is_external_source(abs_path):
            frame["in_app"] = False
            continue

        if _is_in_project_root(abs_path, project_root):
            frame["in_app"] = True
            continue

    return frames


def exc_info_from_error(error):
    # type: (Union[BaseException, ExcInfo]) -> ExcInfo
    if isinstance(error, tuple) and len(error) == 3:
        exc_type, exc_value, tb = error
    elif isinstance(error, BaseException):
        tb = getattr(error, "__traceback__", None)
        if tb is not None:
            exc_type = type(error)
            exc_value = error
        else:
            exc_type, exc_value, tb = sys.exc_info()
            if exc_value is not error:
                tb = None
                exc_value = error
                exc_type = type(error)

    else:
        raise ValueError("Expected Exception object to report, got %s!" % type(error))

    exc_info = (exc_type, exc_value, tb)

    if TYPE_CHECKING:
        # This cast is safe because exc_type and exc_value are either both
        # None or both not None.
        exc_info = cast(ExcInfo, exc_info)

    return exc_info


def merge_stack_frames(frames, full_stack, client_options):
    # type: (List[Dict[str, Any]], List[Dict[str, Any]], Optional[Dict[str, Any]]) -> List[Dict[str, Any]]
    """
    Add the missing frames from full_stack to frames and return the merged list.
    """
    frame_ids = {
        (
            frame["abs_path"],
            frame["context_line"],
            frame["lineno"],
            frame["function"],
        )
        for frame in frames
    }

    new_frames = [
        stackframe
        for stackframe in full_stack
        if (
            stackframe["abs_path"],
            stackframe["context_line"],
            stackframe["lineno"],
            stackframe["function"],
        )
        not in frame_ids
    ]
    new_frames.extend(frames)

    # Limit the number of frames
    max_stack_frames = (
        client_options.get("max_stack_frames", DEFAULT_MAX_STACK_FRAMES)
        if client_options
        else None
    )
    if max_stack_frames is not None:
        new_frames = new_frames[len(new_frames) - max_stack_frames :]

    return new_frames


def event_from_exception(
    exc_info,  # type: Union[BaseException, ExcInfo]
    client_options=None,  # type: Optional[Dict[str, Any]]
    mechanism=None,  # type: Optional[Dict[str, Any]]
):
    # type: (...) -> Tuple[Event, Dict[str, Any]]
    exc_info = exc_info_from_error(exc_info)
    hint = event_hint_with_exc_info(exc_info)

    if client_options and client_options.get("add_full_stack", DEFAULT_ADD_FULL_STACK):
        full_stack = current_stacktrace(
            include_local_variables=client_options["include_local_variables"],
            max_value_length=client_options["max_value_length"],
        )["frames"]
    else:
        full_stack = None

    return (
        {
            "level": "error",
            "exception": {
                "values": exceptions_from_error_tuple(
                    exc_info, client_options, mechanism, full_stack
                )
            },
        },
        hint,
    )


def _module_in_list(name, items):
    # type: (Optional[str], Optional[List[str]]) -> bool
    if name is None:
        return False

    if not items:
        return False

    for item in items:
        if item == name or name.startswith(item + "."):
            return True

    return False


def _is_external_source(abs_path):
    # type: (Optional[str]) -> bool
    # check if frame is in 'site-packages' or 'dist-packages'
    if abs_path is None:
        return False

    external_source = (
        re.search(r"[\\/](?:dist|site)-packages[\\/]", abs_path) is not None
    )
    return external_source


def _is_in_project_root(abs_path, project_root):
    # type: (Optional[str], Optional[str]) -> bool
    if abs_path is None or project_root is None:
        return False

    # check if path is in the project root
    if abs_path.startswith(project_root):
        return True

    return False


def _truncate_by_bytes(string, max_bytes):
    # type: (str, int) -> str
    """
    Truncate a UTF-8-encodable string to the last full codepoint so that it fits in max_bytes.
    """
    truncated = string.encode("utf-8")[: max_bytes - 3].decode("utf-8", errors="ignore")

    return truncated + "..."


def _get_size_in_bytes(value):
    # type: (str) -> Optional[int]
    try:
        return len(value.encode("utf-8"))
    except (UnicodeEncodeError, UnicodeDecodeError):
        return None


def strip_string(value, max_length=None):
    # type: (str, Optional[int]) -> Union[AnnotatedValue, str]
    if not value:
        return value

    if max_length is None:
        max_length = DEFAULT_MAX_VALUE_LENGTH

    byte_size = _get_size_in_bytes(value)
    text_size = len(value)

    if byte_size is not None and byte_size > max_length:
        # truncate to max_length bytes, preserving code points
        truncated_value = _truncate_by_bytes(value, max_length)
    elif text_size is not None and text_size > max_length:
        # fallback to truncating by string length
        truncated_value = value[: max_length - 3] + "..."
    else:
        return value

    return AnnotatedValue(
        value=truncated_value,
        metadata={
            "len": byte_size or text_size,
            "rem": [["!limit", "x", max_length - 3, max_length]],
        },
    )


def parse_version(version):
    # type: (str) -> Optional[Tuple[int, ...]]
    """
    Parses a version string into a tuple of integers.
    This uses the parsing loging from PEP 440:
    https://peps.python.org/pep-0440/#appendix-b-parsing-version-strings-with-regular-expressions
    """
    VERSION_PATTERN = r"""  # noqa: N806
        v?
        (?:
            (?:(?P<epoch>[0-9]+)!)?                           # epoch
            (?P<release>[0-9]+(?:\.[0-9]+)*)                  # release segment
            (?P<pre>                                          # pre-release
                [-_\.]?
                (?P<pre_l>(a|b|c|rc|alpha|beta|pre|preview))
                [-_\.]?
                (?P<pre_n>[0-9]+)?
            )?
            (?P<post>                                         # post release
                (?:-(?P<post_n1>[0-9]+))
                |
                (?:
                    [-_\.]?
                    (?P<post_l>post|rev|r)
                    [-_\.]?
                    (?P<post_n2>[0-9]+)?
                )
            )?
            (?P<dev>                                          # dev release
                [-_\.]?
                (?P<dev_l>dev)
                [-_\.]?
                (?P<dev_n>[0-9]+)?
            )?
        )
        (?:\+(?P<local>[a-z0-9]+(?:[-_\.][a-z0-9]+)*))?       # local version
    """

    pattern = re.compile(
        r"^\s*" + VERSION_PATTERN + r"\s*$",
        re.VERBOSE | re.IGNORECASE,
    )

    try:
        release = pattern.match(version).groupdict()["release"]  # type: ignore
        release_tuple = tuple(map(int, release.split(".")[:3]))  # type: Tuple[int, ...]
    except (TypeError, ValueError, AttributeError):
        return None

    return release_tuple


def _is_contextvars_broken():
    # type: () -> bool
    """
    Returns whether gevent/eventlet have patched the stdlib in a way where thread locals are now more "correct" than contextvars.
    """
    try:
        import gevent
        from gevent.monkey import is_object_patched

        # Get the MAJOR and MINOR version numbers of Gevent
        version_tuple = tuple(
            [int(part) for part in re.split(r"a|b|rc|\.", gevent.__version__)[:2]]
        )
        if is_object_patched("threading", "local"):
            # Gevent 20.9.0 depends on Greenlet 0.4.17 which natively handles switching
            # context vars when greenlets are switched, so, Gevent 20.9.0+ is all fine.
            # Ref: https://github.com/gevent/gevent/blob/83c9e2ae5b0834b8f84233760aabe82c3ba065b4/src/gevent/monkey.py#L604-L609
            # Gevent 20.5, that doesn't depend on Greenlet 0.4.17 with native support
            # for contextvars, is able to patch both thread locals and contextvars, in
            # that case, check if contextvars are effectively patched.
            if (
                # Gevent 20.9.0+
                (sys.version_info >= (3, 7) and version_tuple >= (20, 9))
                # Gevent 20.5.0+ or Python < 3.7
                or (is_object_patched("contextvars", "ContextVar"))
            ):
                return False

            return True
    except ImportError:
        pass

    try:
        import greenlet
        from eventlet.patcher import is_monkey_patched  # type: ignore

        greenlet_version = parse_version(greenlet.__version__)

        if greenlet_version is None:
            logger.error(
                "Internal error in Sentry SDK: Could not parse Greenlet version from greenlet.__version__."
            )
            return False

        if is_monkey_patched("thread") and greenlet_version < (0, 5):
            return True
    except ImportError:
        pass

    return False


def _make_threadlocal_contextvars(local):
    # type: (type) -> type
    class ContextVar:
        # Super-limited impl of ContextVar

        def __init__(self, name, default=None):
            # type: (str, Any) -> None
            self._name = name
            self._default = default
            self._local = local()
            self._original_local = local()

        def get(self, default=None):
            # type: (Any) -> Any
            return getattr(self._local, "value", default or self._default)

        def set(self, value):
            # type: (Any) -> Any
            token = str(random.getrandbits(64))
            original_value = self.get()
            setattr(self._original_local, token, original_value)
            self._local.value = value
            return token

        def reset(self, token):
            # type: (Any) -> None
            self._local.value = getattr(self._original_local, token)
            # delete the original value (this way it works in Python 3.6+)
            del self._original_local.__dict__[token]

    return ContextVar


def _get_contextvars():
    # type: () -> Tuple[bool, type]
    """
    Figure out the "right" contextvars installation to use. Returns a
    `contextvars.ContextVar`-like class with a limited API.

    See https://docs.sentry.io/platforms/python/contextvars/ for more information.
    """
    if not _is_contextvars_broken():
        # On Python 3.7+ contextvars are functional.
        try:
            from contextvars import ContextVar

            return True, ContextVar
        except ImportError:
            pass

    # Fall back to basic thread-local usage.

    from threading import local

    return False, _make_threadlocal_contextvars(local)


HAS_REAL_CONTEXTVARS, ContextVar = _get_contextvars()

CONTEXTVARS_ERROR_MESSAGE = """

With asyncio/ASGI applications, the Sentry SDK requires a functional
installation of `contextvars` to avoid leaking scope/context data across
requests.

Please refer to https://docs.sentry.io/platforms/python/contextvars/ for more information.
"""


def qualname_from_function(func):
    # type: (Callable[..., Any]) -> Optional[str]
    """Return the qualified name of func. Works with regular function, lambda, partial and partialmethod."""
    func_qualname = None  # type: Optional[str]

    # Python 2
    try:
        return "%s.%s.%s" % (
            func.im_class.__module__,  # type: ignore
            func.im_class.__name__,  # type: ignore
            func.__name__,
        )
    except Exception:
        pass

    prefix, suffix = "", ""

    if isinstance(func, partial) and hasattr(func.func, "__name__"):
        prefix, suffix = "partial(<function ", ">)"
        func = func.func
    else:
        # The _partialmethod attribute of methods wrapped with partialmethod() was renamed to __partialmethod__ in CPython 3.13:
        # https://github.com/python/cpython/pull/16600
        partial_method = getattr(func, "_partialmethod", None) or getattr(
            func, "__partialmethod__", None
        )
        if isinstance(partial_method, partialmethod):
            prefix, suffix = "partialmethod(<function ", ">)"
            func = partial_method.func

    if hasattr(func, "__qualname__"):
        func_qualname = func.__qualname__
    elif hasattr(func, "__name__"):  # Python 2.7 has no __qualname__
        func_qualname = func.__name__

    # Python 3: methods, functions, classes
    if func_qualname is not None:
        if hasattr(func, "__module__") and isinstance(func.__module__, str):
            func_qualname = func.__module__ + "." + func_qualname
        func_qualname = prefix + func_qualname + suffix

    return func_qualname


def transaction_from_function(func):
    # type: (Callable[..., Any]) -> Optional[str]
    return qualname_from_function(func)


disable_capture_event = ContextVar("disable_capture_event")


class ServerlessTimeoutWarning(Exception):  # noqa: N818
    """Raised when a serverless method is about to reach its timeout."""

    pass


class TimeoutThread(threading.Thread):
    """Creates a Thread which runs (sleeps) for a time duration equal to
    waiting_time and raises a custom ServerlessTimeout exception.
    """

    def __init__(self, waiting_time, configured_timeout):
        # type: (float, int) -> None
        threading.Thread.__init__(self)
        self.waiting_time = waiting_time
        self.configured_timeout = configured_timeout
        self._stop_event = threading.Event()

    def stop(self):
        # type: () -> None
        self._stop_event.set()

    def run(self):
        # type: () -> None

        self._stop_event.wait(self.waiting_time)

        if self._stop_event.is_set():
            return

        integer_configured_timeout = int(self.configured_timeout)

        # Setting up the exact integer value of configured time(in seconds)
        if integer_configured_timeout < self.configured_timeout:
            integer_configured_timeout = integer_configured_timeout + 1

        # Raising Exception after timeout duration is reached
        raise ServerlessTimeoutWarning(
            "WARNING : Function is expected to get timed out. Configured timeout duration = {} seconds.".format(
                integer_configured_timeout
            )
        )


def to_base64(original):
    # type: (str) -> Optional[str]
    """
    Convert a string to base64, via UTF-8. Returns None on invalid input.
    """
    base64_string = None

    try:
        utf8_bytes = original.encode("UTF-8")
        base64_bytes = base64.b64encode(utf8_bytes)
        base64_string = base64_bytes.decode("UTF-8")
    except Exception as err:
        logger.warning("Unable to encode {orig} to base64:".format(orig=original), err)

    return base64_string


def from_base64(base64_string):
    # type: (str) -> Optional[str]
    """
    Convert a string from base64, via UTF-8. Returns None on invalid input.
    """
    utf8_string = None

    try:
        only_valid_chars = BASE64_ALPHABET.match(base64_string)
        assert only_valid_chars

        base64_bytes = base64_string.encode("UTF-8")
        utf8_bytes = base64.b64decode(base64_bytes)
        utf8_string = utf8_bytes.decode("UTF-8")
    except Exception as err:
        logger.warning(
            "Unable to decode {b64} from base64:".format(b64=base64_string), err
        )

    return utf8_string


Components = namedtuple("Components", ["scheme", "netloc", "path", "query", "fragment"])


def sanitize_url(url, remove_authority=True, remove_query_values=True, split=False):
    # type: (str, bool, bool, bool) -> Union[str, Components]
    """
    Removes the authority and query parameter values from a given URL.
    """
    parsed_url = urlsplit(url)
    query_params = parse_qs(parsed_url.query, keep_blank_values=True)

    # strip username:password (netloc can be usr:pwd@example.com)
    if remove_authority:
        netloc_parts = parsed_url.netloc.split("@")
        if len(netloc_parts) > 1:
            netloc = "%s:%s@%s" % (
                SENSITIVE_DATA_SUBSTITUTE,
                SENSITIVE_DATA_SUBSTITUTE,
                netloc_parts[-1],
            )
        else:
            netloc = parsed_url.netloc
    else:
        netloc = parsed_url.netloc

    # strip values from query string
    if remove_query_values:
        query_string = unquote(
            urlencode({key: SENSITIVE_DATA_SUBSTITUTE for key in query_params})
        )
    else:
        query_string = parsed_url.query

    components = Components(
        scheme=parsed_url.scheme,
        netloc=netloc,
        query=query_string,
        path=parsed_url.path,
        fragment=parsed_url.fragment,
    )

    if split:
        return components
    else:
        return urlunsplit(components)


ParsedUrl = namedtuple("ParsedUrl", ["url", "query", "fragment"])


def parse_url(url, sanitize=True):
    # type: (str, bool) -> ParsedUrl
    """
    Splits a URL into a url (including path), query and fragment. If sanitize is True, the query
    parameters will be sanitized to remove sensitive data. The autority (username and password)
    in the URL will always be removed.
    """
    parsed_url = sanitize_url(
        url, remove_authority=True, remove_query_values=sanitize, split=True
    )

    base_url = urlunsplit(
        Components(
            scheme=parsed_url.scheme,  # type: ignore
            netloc=parsed_url.netloc,  # type: ignore
            query="",
            path=parsed_url.path,  # type: ignore
            fragment="",
        )
    )

    return ParsedUrl(
        url=base_url,
        query=parsed_url.query,  # type: ignore
        fragment=parsed_url.fragment,  # type: ignore
    )


def is_valid_sample_rate(rate, source):
    # type: (Any, str) -> bool
    """
    Checks the given sample rate to make sure it is valid type and value (a
    boolean or a number between 0 and 1, inclusive).
    """

    # both booleans and NaN are instances of Real, so a) checking for Real
    # checks for the possibility of a boolean also, and b) we have to check
    # separately for NaN and Decimal does not derive from Real so need to check that too
    if not isinstance(rate, (Real, Decimal)) or math.isnan(rate):
        logger.warning(
            "{source} Given sample rate is invalid. Sample rate must be a boolean or a number between 0 and 1. Got {rate} of type {type}.".format(
                source=source, rate=rate, type=type(rate)
            )
        )
        return False

    # in case rate is a boolean, it will get cast to 1 if it's True and 0 if it's False
    rate = float(rate)
    if rate < 0 or rate > 1:
        logger.warning(
            "{source} Given sample rate is invalid. Sample rate must be between 0 and 1. Got {rate}.".format(
                source=source, rate=rate
            )
        )
        return False

    return True


def match_regex_list(item, regex_list=None, substring_matching=False):
    # type: (str, Optional[List[str]], bool) -> bool
    if regex_list is None:
        return False

    for item_matcher in regex_list:
        if not substring_matching and item_matcher[-1] != "$":
            item_matcher += "$"

        matched = re.search(item_matcher, item)
        if matched:
            return True

    return False


def is_sentry_url(client, url):
    # type: (sentry_sdk.client.BaseClient, str) -> bool
    """
    Determines whether the given URL matches the Sentry DSN.
    """
    return (
        client is not None
        and client.transport is not None
        and client.transport.parsed_dsn is not None
        and client.transport.parsed_dsn.netloc in url
    )


def _generate_installed_modules():
    # type: () -> Iterator[Tuple[str, str]]
    try:
        from importlib import metadata

        yielded = set()
        for dist in metadata.distributions():
            name = dist.metadata.get("Name", None)  # type: ignore[attr-defined]
            # `metadata` values may be `None`, see:
            # https://github.com/python/cpython/issues/91216
            # and
            # https://github.com/python/importlib_metadata/issues/371
            if name is not None:
                normalized_name = _normalize_module_name(name)
                if dist.version is not None and normalized_name not in yielded:
                    yield normalized_name, dist.version
                    yielded.add(normalized_name)

    except ImportError:
        # < py3.8
        try:
            import pkg_resources
        except ImportError:
            return

        for info in pkg_resources.working_set:
            yield _normalize_module_name(info.key), info.version


def _normalize_module_name(name):
    # type: (str) -> str
    return name.lower()


def _get_installed_modules():
    # type: () -> Dict[str, str]
    global _installed_modules
    if _installed_modules is None:
        _installed_modules = dict(_generate_installed_modules())
    return _installed_modules


def package_version(package):
    # type: (str) -> Optional[Tuple[int, ...]]
    installed_packages = _get_installed_modules()
    version = installed_packages.get(package)
    if version is None:
        return None

    return parse_version(version)


def reraise(tp, value, tb=None):
    # type: (Optional[Type[BaseException]], Optional[BaseException], Optional[Any]) -> NoReturn
    assert value is not None
    if value.__traceback__ is not tb:
        raise value.with_traceback(tb)
    raise value


def _no_op(*_a, **_k):
    # type: (*Any, **Any) -> None
    """No-op function for ensure_integration_enabled."""
    pass


if TYPE_CHECKING:

    @overload
    def ensure_integration_enabled(
        integration,  # type: type[sentry_sdk.integrations.Integration]
        original_function,  # type: Callable[P, R]
    ):
        # type: (...) -> Callable[[Callable[P, R]], Callable[P, R]]
        ...

    @overload
    def ensure_integration_enabled(
        integration,  # type: type[sentry_sdk.integrations.Integration]
    ):
        # type: (...) -> Callable[[Callable[P, None]], Callable[P, None]]
        ...


def ensure_integration_enabled(
    integration,  # type: type[sentry_sdk.integrations.Integration]
    original_function=_no_op,  # type: Union[Callable[P, R], Callable[P, None]]
):
    # type: (...) -> Callable[[Callable[P, R]], Callable[P, R]]
    """
    Ensures a given integration is enabled prior to calling a Sentry-patched function.

    The function takes as its parameters the integration that must be enabled and the original
    function that the SDK is patching. The function returns a function that takes the
    decorated (Sentry-patched) function as its parameter, and returns a function that, when
    called, checks whether the given integration is enabled. If the integration is enabled, the
    function calls the decorated, Sentry-patched function. If the integration is not enabled,
    the original function is called.

    The function also takes care of preserving the original function's signature and docstring.

    Example usage:

    ```python
    @ensure_integration_enabled(MyIntegration, my_function)
    def patch_my_function():
        with sentry_sdk.start_span(...):
            return my_function()
    ```
    """
    if TYPE_CHECKING:
        # Type hint to ensure the default function has the right typing. The overloads
        # ensure the default _no_op function is only used when R is None.
        original_function = cast(Callable[P, R], original_function)

    def patcher(sentry_patched_function):
        # type: (Callable[P, R]) -> Callable[P, R]
        def runner(*args: "P.args", **kwargs: "P.kwargs"):
            # type: (...) -> R
            if sentry_sdk_alpha.get_client().get_integration(integration) is None:
                return original_function(*args, **kwargs)

            return sentry_patched_function(*args, **kwargs)

        if original_function is _no_op:
            return wraps(sentry_patched_function)(runner)

        return wraps(original_function)(runner)

    return patcher


def now():
    # type: () -> float
    return time.perf_counter()


try:
    from gevent import get_hub as get_gevent_hub
    from gevent.monkey import is_module_patched
except ImportError:

    # it's not great that the signatures are different, get_hub can't return None
    # consider adding an if TYPE_CHECKING to change the signature to Optional[GeventHub]
    def get_gevent_hub():  # type: ignore[misc]
        # type: () -> Optional[GeventHub]
        return None

    def is_module_patched(mod_name):
        # type: (str) -> bool
        # unable to import from gevent means no modules have been patched
        return False


def is_gevent():
    # type: () -> bool
    return is_module_patched("threading") or is_module_patched("_thread")


def get_current_thread_meta(thread=None):
    # type: (Optional[threading.Thread]) -> Tuple[Optional[int], Optional[str]]
    """
    Try to get the id of the current thread, with various fall backs.
    """

    # if a thread is specified, that takes priority
    if thread is not None:
        try:
            thread_id = thread.ident
            thread_name = thread.name
            if thread_id is not None:
                return thread_id, thread_name
        except AttributeError:
            pass

    # if the app is using gevent, we should look at the gevent hub first
    # as the id there differs from what the threading module reports
    if is_gevent():
        gevent_hub = get_gevent_hub()
        if gevent_hub is not None:
            try:
                # this is undocumented, so wrap it in try except to be safe
                return gevent_hub.thread_ident, None
            except AttributeError:
                pass

    # use the current thread's id if possible
    try:
        thread = threading.current_thread()
        thread_id = thread.ident
        thread_name = thread.name
        if thread_id is not None:
            return thread_id, thread_name
    except AttributeError:
        pass

    # if we can't get the current thread id, fall back to the main thread id
    try:
        thread = threading.main_thread()
        thread_id = thread.ident
        thread_name = thread.name
        if thread_id is not None:
            return thread_id, thread_name
    except AttributeError:
        pass

    # we've tried everything, time to give up
    return None, None


def _serialize_span_attribute(value):
    # type: (Any) -> Optional[AttributeValue]
    """Serialize an object so that it's OTel-compatible and displays nicely in Sentry."""
    # check for allowed primitives
    if isinstance(value, (int, str, float, bool)):
        return value

    # lists are allowed too, as long as they don't mix types
    if isinstance(value, (list, tuple)):
        for type_ in (int, str, float, bool):
            if all(isinstance(item, type_) for item in value):
                return list(value)

    # if this is anything else, just try to coerce to string
    # we prefer json.dumps since this makes things like dictionaries display
    # nicely in the UI
    try:
        return json.dumps(value)
    except TypeError:
        try:
            return str(value)
        except Exception:
            return None


ISO_TZ_SEPARATORS = frozenset(("+", "-"))


def datetime_from_isoformat(value):
    # type: (str) -> datetime
    try:
        result = datetime.fromisoformat(value)
    except (AttributeError, ValueError):
        # py 3.6
        timestamp_format = (
            "%Y-%m-%dT%H:%M:%S.%f" if "." in value else "%Y-%m-%dT%H:%M:%S"
        )
        if value.endswith("Z"):
            value = value[:-1] + "+0000"

        if value[-6] in ISO_TZ_SEPARATORS:
            timestamp_format += "%z"
            value = value[:-3] + value[-2:]
        elif value[-5] in ISO_TZ_SEPARATORS:
            timestamp_format += "%z"

        result = datetime.strptime(value, timestamp_format)
    return result.astimezone(timezone.utc)


def should_be_treated_as_error(ty, value):
    # type: (Any, Any) -> bool
    if ty == SystemExit and hasattr(value, "code") and value.code in (0, None):
        # https://docs.python.org/3/library/exceptions.html#SystemExit
        return False

    return True


def http_client_status_to_breadcrumb_level(status_code):
    # type: (Optional[int]) -> str
    if status_code is not None:
        if 500 <= status_code <= 599:
            return "error"
        elif 400 <= status_code <= 499:
            return "warning"

    return "info"


def set_thread_info_from_span(data, span):
    # type: (Dict[str, Any], sentry_sdk.tracing.Span) -> None
    if span.get_attribute(SPANDATA.THREAD_ID) is not None:
        data[SPANDATA.THREAD_ID] = span.get_attribute(SPANDATA.THREAD_ID)
        if span.get_attribute(SPANDATA.THREAD_NAME) is not None:
            data[SPANDATA.THREAD_NAME] = span.get_attribute(SPANDATA.THREAD_NAME)
