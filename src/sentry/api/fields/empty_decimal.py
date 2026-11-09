from decimal import Decimal

from rest_framework import serializers
from rest_framework.fields import empty


class EmptyDecimalField(serializers.DecimalField):
    """
    DRF used to translate a blank field as a null decimal, but after 3.x it
    doesn't accept an empty string as a value. We rely on this behaviour in some
    cases, so this restores it.
    """

    def run_validation(self, data: object = empty) -> Decimal | None:
        if data == "":
            return None
        return super().run_validation(data)
