from __future__ import annotations

from sentry.stacktraces.processing import find_stacktraces_in_data
from sentry.utils.safe import get_path

from .errorlocale import translate_exception
from .errormapping import rewrite_exception
from .utils import generate_module


def preprocess_event(data):
    rewrite_exception(data)
    translate_exception(data)
    generate_modules(data)
    return data


def generate_modules(data):
    for info in find_stacktraces_in_data(data):
        for frame in get_path(info.stacktrace, "frames", filter=True, default=()):
            platform = frame.get("platform") or data["platform"]
            if platform not in ("javascript", "node") or frame.get("module"):
                continue
            abs_path = frame.get("abs_path")
            if abs_path and abs_path.startswith(("http:", "https:", "webpack:", "app:")):
                frame["module"] = generate_module(abs_path)
