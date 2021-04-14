from functools import partial

from yaml import load as _load

try:
    # Try to load bindings with libyaml if available
    from yaml import CSafeLoader as SafeLoader
except ImportError:
    from yaml import SafeLoader

safe_load = partial(_load, Loader=SafeLoader)
