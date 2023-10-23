from typing import List

from .manager import ProviderManager

manager = ProviderManager()
register = manager.register
unregister = manager.unregister


def find_providers_requiring_refresh() -> List[str]:
    return [name for name, provider in manager if provider.requires_refresh]
