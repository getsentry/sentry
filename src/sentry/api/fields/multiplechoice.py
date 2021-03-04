from rest_framework import serializers


class MultipleChoiceField(serializers.Field):
    error_messages = {
        "invalid_choice": ("Select a valid choice. {value} is not one of " "the available choices.")
    }

    def __init__(self, choices=None, *args, **kwargs):
        self.choices = set(choices or ())
        super().__init__(*args, **kwargs)

    def to_representation(self, value):
        return value

    def to_internal_value(self, data):
        if isinstance(data, list):
            for item in data:
                if item not in self.choices:
                    raise serializers.ValidationError(
                        self.error_messages["invalid_choice"].format(value=item)
                    )
            return data
        raise serializers.ValidationError("Please provide a valid list.")
