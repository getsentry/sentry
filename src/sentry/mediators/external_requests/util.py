from __future__ import absolute_import

from jsonschema import Draft4Validator

SELECT_OPTIONS_SCHEMA = {
    'type': 'array',
    'definitions': {
        'select-option': {
            'type': 'object',
            'properties': {
                'label': {
                    'type': 'string',
                },
                'value': {
                    'type': 'string',
                }
            },
            'required': ['label', 'value'],
        }
    },
    'properties': {
        'type': 'array',
        'items': {'$ref': '#definitions/select-option'}
    }
}

SCHEMA_LIST = {
    'select': SELECT_OPTIONS_SCHEMA,
}


def validate(instance, schema_type):
    schema = SCHEMA_LIST[schema_type]
    v = Draft4Validator(schema)

    if not v.is_valid(instance):
        return False

    return True
