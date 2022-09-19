from __future__ import annotations

from functools import partial

import yaml

# Try to load bindings with libyaml if available
SafeLoader: type[yaml.CSafeLoader] | type[yaml.SafeLoader]
SafeLoader = getattr(yaml, "CSafeLoader", yaml.SafeLoader)

safe_load = partial(yaml.load, Loader=SafeLoader)
