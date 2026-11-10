from typing import Any

from sentry.inbox.types import InboxEventType, InboxItemType
from sentry.utils.registry import Registry

inbox_item_type_registry = Registry[InboxItemType[Any]](enable_reverse_lookup=False)
inbox_item_event_type_registry = Registry[InboxEventType[Any, Any]](enable_reverse_lookup=False)
