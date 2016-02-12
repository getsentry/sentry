"""
sentry.utils.yaml
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from functools import partial
from yaml import load as _load, dump as _dump
try:
    # Try to load bindings with libyaml if available
    from yaml import (
        CLoader as Loader,
        CDumper as Dumper,
        CSafeLoader as SafeLoader,
        CSafeDumper as SafeDumper,
    )
except ImportError:
    from yaml import (
        Loader, Dumper,
        SafeLoader, SafeDumper,
    )


load = partial(_load, Loader=Loader)
dump = partial(_dump, Dumper=Dumper)
safe_load = partial(_load, Loader=SafeLoader)
safe_dump = partial(_dump, Dumper=SafeDumper)
