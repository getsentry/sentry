from __future__ import annotations

import pkgutil
import subprocess
import sys

import pytest

from sentry.conf import types
from sentry.utils import json

ALLOWLIST = frozenset(
    (
        "sentry.conf",
        "sentry.conf.types",
        "sentry.conf.types.kafka_definition",
        # these come from sentry.__init__ -- please don't make this longer!
        "sentry._importchecker",
        "sentry.monkey",
        "sentry.monkey.pickle",
    )
)
MODNAMES = ["sentry.conf.types"] + [
    info.name for info in list(pkgutil.iter_modules(types.__path__, f"{types.__name__}."))
]


@pytest.mark.parametrize("modname", MODNAMES)
def test_module_does_not_import_sentry(modname):
    prog = f"""\
import json
import sys
import {modname}
mods = [k for k in sys.modules if k.startswith("sentry.") if k != {modname!r}]
print(json.dumps(mods))
"""
    out = subprocess.check_output((sys.executable, "-c", prog))
    mods = set(json.loads(out))
    mods.difference_update(ALLOWLIST)
    if mods:
        module_list = "".join(f"- {mod}\n" for mod in sorted(mods))
        raise AssertionError(
            f"{modname} imports other sentry modules!\n\n"
            f"in order to keep `django-stubs` working, these types are "
            f"forbidden from importing any other modules (due to import "
            f"cycles)\n\n"
            f"imported names:\n{module_list}"
        )
