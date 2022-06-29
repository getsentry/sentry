from rest_framework.serializers import ListField


class EmptyListField(ListField):
    def to_internal_value(self, data):
        if data == "":
            return ""
        return super().to_internal_value(data)
