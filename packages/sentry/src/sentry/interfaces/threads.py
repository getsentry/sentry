from sentry.interfaces.base import Interface
from sentry.interfaces.stacktrace import Stacktrace
from sentry.utils.json import prune_empty_keys
from sentry.utils.safe import get_path, trim

__all__ = ("Threads",)


def get_stacktrace(value, path, **kwargs):
    # Special case: if the thread has no frames we set the
    # stacktrace to none.  Otherwise this will fail really
    # badly.
    subvalue = get_path(value, *path)
    if subvalue and subvalue.get("frames"):
        return Stacktrace.to_python_subpath(value, path, **kwargs)


class Threads(Interface):
    score = 1900
    grouping_variants = ["system", "app"]

    @classmethod
    def to_python(cls, data, **kwargs):
        threads = []

        for i, thread in enumerate(data.get("values") or ()):
            if thread is None:
                # XXX(markus): We should handle this in the UI and other
                # consumers of this interface
                continue
            threads.append(
                {
                    "stacktrace": get_stacktrace(data, ["values", i, "stacktrace"], **kwargs),
                    "raw_stacktrace": get_stacktrace(
                        data, ["values", i, "raw_stacktrace"], **kwargs
                    ),
                    "id": trim(thread.get("id"), 40),
                    "crashed": bool(thread.get("crashed")),
                    "current": bool(thread.get("current")),
                    "name": trim(thread.get("name"), 200),
                }
            )

        return super().to_python({"values": threads}, **kwargs)

    def to_json(self):
        def export_thread(data):
            if data is None:
                return None

            rv = {
                "id": data["id"],
                "current": data["current"],
                "crashed": data["crashed"],
                "name": data["name"],
                "stacktrace": None,
            }
            if data["stacktrace"]:
                rv["stacktrace"] = data["stacktrace"].to_json()
            if data["raw_stacktrace"]:
                rv["raw_stacktrace"] = data["raw_stacktrace"].to_json()
            return prune_empty_keys(rv)

        return prune_empty_keys({"values": [export_thread(x) for x in self.values]})

    def get_api_context(self, is_public=False, platform=None):
        def export_thread(data):
            rv = {
                "id": data["id"],
                "current": data["current"],
                "crashed": data["crashed"],
                "name": data["name"],
                "stacktrace": None,
                "rawStacktrace": None,
            }
            if data["stacktrace"]:
                rv["stacktrace"] = data["stacktrace"].get_api_context(is_public=is_public)
            if data["raw_stacktrace"]:
                rv["rawStacktrace"] = data["raw_stacktrace"].get_api_context(is_public=is_public)
            return rv

        return {"values": [export_thread(x) for x in self.values]}

    def get_meta_context(self, meta, is_public=False, platform=None):
        if meta and "values" not in meta:
            return {"values": meta}
        else:
            return meta
