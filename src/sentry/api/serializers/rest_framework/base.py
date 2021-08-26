from django.utils.text import re_camel_case
from rest_framework.fields import empty
from rest_framework.serializers import ModelSerializer, Serializer


def camel_to_snake_case(value):
    """
    Splits CamelCase and converts to lower case with underscores.
    """
    return re_camel_case.sub(r"_\1", value).strip("_").lower()


def snake_to_camel_case(value):
    """
    Converts a string from snake_case to camelCase
    """
    words = value.strip("_").split("_")
    return words[0].lower() + "".join(word.capitalize() for word in words[1:])


def convert_dict_key_case(obj, converter):
    """
    Recursively converts the keys of a dictionary using the provided converter
    param.
    """
    if isinstance(obj, list):
        return [convert_dict_key_case(x, converter) for x in obj]

    if not isinstance(obj, dict):
        return obj

    obj = obj.copy()
    for key in list(obj.keys()):
        converted_key = converter(key)
        obj[converted_key] = convert_dict_key_case(obj.pop(key), converter)

    return obj


class CamelSnakeSerializer(Serializer):
    """
    Allows parameters to be defined in snake case, but passed as camel case.

    Errors are output in camel case.
    """

    def __init__(self, instance=None, data=empty, **kwargs):
        if data is not empty:
            data = convert_dict_key_case(data, camel_to_snake_case)
        return super().__init__(instance=instance, data=data, **kwargs)

    @property
    def errors(self):
        errors = super().errors
        return convert_dict_key_case(errors, snake_to_camel_case)


class CamelSnakeModelSerializer(ModelSerializer):
    """
    Allows parameters to be defined in snake case, but passed as camel case.

    Errors are output in camel case.
    """

    def __init__(self, instance=None, data=empty, **kwargs):
        if data is not empty:
            data = convert_dict_key_case(data, camel_to_snake_case)
        return super().__init__(instance=instance, data=data, **kwargs)

    @property
    def errors(self):
        errors = super().errors
        return convert_dict_key_case(errors, snake_to_camel_case)
