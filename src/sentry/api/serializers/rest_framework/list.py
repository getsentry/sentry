from rest_framework.serializers import ListField  # NOQA


class EmptyListField(ListField):
    def to_internal_value(self, data):
        if data == "":
            return ""
        return super().to_internal_value(data)
