from typing import int, Never

from rest_framework import serializers


class InboxDetailsValidator(serializers.Serializer[Never]):
    # Support undo / snooze reasons
    pass
