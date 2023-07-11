from __future__ import annotations

import atexit
import builtins
import functools
import os
import sys
from typing import IO

real_import = builtins.__import__


TRACK_IMPORTS = os.environ.get("SENTRY_TRACK_IMPORTS") == "1"
TRACKED_PACKAGES = ("sentry", "getsentry")

observations: set[tuple[str, str]] = set()
import_order: list[str] = []


def resolve_full_name(base, name, level):
    """Resolve a relative module name to an absolute one."""
    if level == 0:
        return name
    bits = base.rsplit(".", level - 1)
    base = bits[0]
    return f"{base}.{name}" if name else base


def is_relevant_import(package):
    if package is None:
        return False
    return package in TRACKED_PACKAGES or package.split(".")[0] in TRACKED_PACKAGES


def emit_dot(filename):
    modules: dict[str, int] = {}

    def _register_module(name):
        if modules.get(name) is not None:
            return
        modules[name] = len(modules)

    with open(filename, "w") as f:
        f.write("digraph {\n")

        for from_name, to_name in observations:
            _register_module(from_name)
            _register_module(to_name)

        for module_name, id in sorted(modules.items(), key=lambda x: x[1]):
            f.write(f'  {id} [label="{module_name}" color="red"]\n')

        for pair in observations:
            f.write(f'  {modules[pair[0]]} -> {modules[pair[1]]} [color="gray"]\n')

        f.write("}\n")


def emit_ascii_tree(filename):
    dependencies: dict[str, set[str]] = {}

    for from_name, to_name in observations:
        dependencies.setdefault(from_name, set()).add(to_name)

    indentation = 0

    def _write_dep(f: IO[str], name: str, seen: dict[str, int]) -> None:
        nonlocal indentation
        marker = f"{indentation:02}"
        children = dependencies.get(name) or set()
        if name in seen:
            count = seen[name]
            seen[name] = count + 1
            f.write(f"{'  ' * indentation}-{marker} {name} ({count})\n")
            return
        seen[name] = 1
        f.write(f"{'  ' * indentation}-{marker} {name}:\n")
        indentation += 1
        for child in sorted(children):
            _write_dep(f, child, seen=seen)
        indentation -= 1

    seen: dict[str, int] = {}
    with open(filename, "w") as f:
        for name in import_order:
            _write_dep(f, name, seen=seen)

        top_n = sorted(seen.items(), key=lambda x: x[1], reverse=True)
        f.write("\nTop dependencies:\n")
        for name, count in top_n[:30]:
            f.write(f"  - {name}: {count}\n")


def track_import(from_name, to_name, fromlist):
    if not is_relevant_import(from_name) or not is_relevant_import(to_name):
        return

    if sys.modules.get(to_name) is not None and sys.modules.get(from_name) is not None:
        if to_name not in import_order:
            import_order.append(to_name)
        observations.add((from_name, to_name))

        for name in fromlist or ():
            potential_module_name = to_name + "." + name
            if sys.modules.get(potential_module_name) is not None:
                observations.add((from_name, potential_module_name))


@functools.wraps(real_import)
def checking_import(name, globals=None, locals=None, fromlist=(), level=0):
    if globals is None:
        globals = sys._getframe(1).f_globals

    from_name = globals.get("__name__")
    package = globals.get("__package__") or from_name

    if not from_name or not package:
        return real_import(name, globals, locals, fromlist, level)

    to_name = resolve_full_name(package, name, level)
    try:
        return real_import(name, globals, locals, fromlist, level)
    finally:
        track_import(from_name, to_name, fromlist)


def write_files():
    import sentry

    base = os.path.abspath(os.path.join(sentry.__file__, "../../.."))

    emit_dot(os.path.join(base, "import-graph.dot"))
    emit_ascii_tree(os.path.join(base, "import-graph.txt"))


if TRACK_IMPORTS:
    builtins.__import__ = checking_import
    atexit.register(write_files)
