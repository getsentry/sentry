from typing import Any

from rest_framework import serializers


class InboxDetailsValidator(serializers.Serializer[dict[Any, dict[str, Any]]]):
    # Support undo / snooze reasons
    pass
