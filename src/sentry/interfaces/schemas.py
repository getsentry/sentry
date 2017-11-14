"""
sentry.interfaces.schemas
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from itertools import groupby
import jsonschema
import six
import uuid

from sentry.db.models import BoundedIntegerField
from sentry.constants import (
    LOG_LEVELS_MAP,
    MAX_TAG_KEY_LENGTH,
    MAX_TAG_VALUE_LENGTH,
    VALID_PLATFORMS,
)
from sentry.interfaces.base import InterfaceValidationError
from sentry.models import EventError
from sentry.tagstore.base import INTERNAL_TAG_KEYS


def iverror(message="Invalid data"):
    raise InterfaceValidationError(message)


def apierror(message="Invalid data"):
    from sentry.coreapi import APIForbidden
    raise APIForbidden(message)

PAIRS = {
    'type': 'array',
    'items': {
        'type': 'array',
        'minItems': 2,
        'maxItems': 2,
        'items': {'type': 'string'}
    }
}

HTTP_INTERFACE_SCHEMA = {
    'type': 'object',
    'properties': {
        'url': {
            'type': 'string',
            'minLength': 1,
        },
        'method': {'type': 'string'},
        'query_string': {'type': ['string', 'object']},
        'inferred_content_type': {'type': 'string'},
        'cookies': {
            'anyOf': [
                {'type': ['string', 'object']},  # either a string of object
                PAIRS,  # or a list of 2-tuples
            ]
        },
        'env': {'type': 'object'},
        'headers': {
            'anyOf': [
                {'type': 'object'},  # either an object
                PAIRS,  # or a list of 2-tuples
            ]
        },
        'data': {'type': ['string', 'object', 'array']},
        'fragment': {'type': 'string'},
    },
    'required': ['url'],
    'additionalProperties': True,
}

FRAME_INTERFACE_SCHEMA = {
    'type': 'object',
    'properties': {
        'abs_path': {
            'type': 'string',
            'default': iverror,
        },
        'colno': {'type': ['number', 'string']},
        'context_line': {'type': 'string'},
        'data': {
            'anyOf': [
                {'type': 'object'},
                PAIRS,
            ]
        },
        'errors': {},
        'filename': {
            'type': 'string',
            'default': iverror,
        },
        'function': {'type': 'string'},
        'image_addr': {},
        'in_app': {'type': 'boolean', 'default': False},
        'instruction_addr': {},
        'lineno': {'type': ['number', 'string']},
        'module': {
            'type': 'string',
            'default': iverror,
        },
        'package': {'type': 'string'},
        'platform': {
            'type': 'string',
            'enum': list(VALID_PLATFORMS),
        },
        'post_context': {},
        'pre_context': {},
        'symbol': {'type': 'string'},
        'symbol_addr': {},
        'vars': {
            'anyOf': [
                {'type': 'object'},
                PAIRS,
            ]
        },
    },
    'anyOf': [
        # TODO abs_path vs. filename validation depends on whether this is a raw frame or not.
        {'required': ['abs_path']},
        {'required': ['filename']},
        {
            # can only accept function on its own if it's not None or '?'
            'required': ['function'],
            'properties': {
                'function': {
                    'type': 'string',  # TODO probably shouldn't allow empty string either
                    'not': {'pattern': '^\?$'},
                },
            },
        },
        {'required': ['module']},
        {'required': ['package']},
    ],
    'additionalProperties': False,
}

STACKTRACE_INTERFACE_SCHEMA = {
    'type': 'object',
    'properties': {
        'frames': {
            'type': 'array',
            # To validate individual frames use FRAME_INTERFACE_SCHEMA
            'items': {'type': 'object'},
            'minItems': 1,
        },
        'frames_omitted': {
            'type': 'array',
            'maxItems': 2,
            'minItems': 2,
            'items': {'type': 'number'},
        },
        'registers': {'type': 'object'},
    },
    'required': ['frames'],
    'additionalProperties': False,
}

EXCEPTION_INTERFACE_SCHEMA = {
    'type': 'object',
    'properties': {
        'type': {
            'type': 'string',
            # 'minLength': 1,
        },
        'value': {
            # 'minProperties': 1,
            # 'minItems': 1,
            # 'minLength': 1,
        },
        'module': {'type': 'string'},
        'mechanism': {'type': 'object'},
        'stacktrace': {
            # To validate stacktraces use STACKTRACE_INTERFACE_SCHEMA
            'type': 'object',
            'properties': {
                # The code allows for the possibility of an empty
                # {"frames":[]} object, this sucks and should go.
                # STACKTRACE_INTERFACE_SCHEMA enforces at least 1
                'frames': {'type': 'array'},
            },
        },
        'thread_id': {},
        'raw_stacktrace': {
            'type': 'object',
            'properties': {
                'frames': {'type': 'array'},
            },
        },
    },
    'anyOf': [  # Require at least one of these keys.
        {'required': ['type']},
        {'required': ['value']},
    ],
    # TODO should be false but allowing extra garbage for now
    # for compatibility
    'additionalProperties': True,
}

TEMPLATE_INTERFACE_SCHEMA = {'type': 'object'}  # TODO fill this out
MESSAGE_INTERFACE_SCHEMA = {'type': 'object'}

TAGS_DICT_SCHEMA = {
    'allOf': [
        {
            'type': 'object',
            # TODO with draft 6 support, we can just use propertyNames/maxLength
            'patternProperties': {
                '^[a-zA-Z0-9_\.:-]{1,%d}$' % MAX_TAG_KEY_LENGTH: {
                    'type': 'string',
                    'maxLength': MAX_TAG_VALUE_LENGTH,
                    'pattern': '^[^\n]+\Z',  # \Z because $ matches before trailing newline
                }
            },
            'additionalProperties': False,
        },
        {
            # This is a negative match for all the reserved tags
            'type': 'object',
            'patternProperties': {
                '^(%s)$' % '|'.join(INTERNAL_TAG_KEYS): {'not': {}}
            },
            'additionalProperties': True,
        },
    ],
}

TAGS_TUPLES_SCHEMA = {
    'type': 'array',
    'items': {
        'type': 'array',
        'minItems': 2,
        'maxItems': 2,
        'items': [
            # Key
            {
                'type': 'string',
                'pattern': '^[a-zA-Z0-9_\.:-]+$',
                'maxLength': MAX_TAG_KEY_LENGTH,
                'not': {
                    'pattern': '^(%s)$' % '|'.join(INTERNAL_TAG_KEYS),
                },
            },
            # Value
            {
                'type': 'string',
                'pattern': '^[^\n]*\Z',  # \Z because $ matches before a trailing newline
                # 'minLength': 1,
                'maxLength': MAX_TAG_VALUE_LENGTH,
            },
        ]
    }
}

TAGS_SCHEMA = {
    'anyOf': [TAGS_DICT_SCHEMA, TAGS_TUPLES_SCHEMA]
}

EVENT_SCHEMA = {
    'type': 'object',
    'properties': {
        'event_id': {
            'type': 'string',
            'pattern': '^[a-fA-F0-9]+$',
            'maxLength': 32,
            'minLength': 32,
            'default': lambda: uuid.uuid4().hex,
        },
        'timestamp': {
            'anyOf': [
                {'type': 'string', 'format': 'date-time'},
                {'type': 'number'}
            ],
        },
        'logger': {'type': 'string'},
        'platform': {
            'type': 'string',
            'enum': list(VALID_PLATFORMS),
            'default': 'other',
        },
        'sdk': {
            'type': 'object',
            'properties': {
                'name': {'type': 'string'},
                'version': {},
                'integrations': {},
            },
            'additionalProperties': True,
        },
        'level': {
            'anyOf': [
                {'type': 'number'},
                {
                    'type': 'string',
                    'pattern': '^[0-9]+$',
                },
                {
                    'type': 'string',
                    'enum': LOG_LEVELS_MAP.keys(),
                },
            ],
        },
        'culprit': {
            'type': 'string',
            # 'minLength': 1,
            # 'maxLength': MAX_CULPRIT_LENGTH,
            'default': lambda: apierror('Invalid value for culprit'),
        },
        'server_name': {'type': 'string'},
        'release': {
            'type': 'string',
            'maxLength': 64,
        },
        'dist': {
            'type': 'string',
            'pattern': '^[a-zA-Z0-9_.-]+$',
            'maxLength': 64,
        },
        'tags': {
            # This is a loose tags schema, individual tags
            # are also validated more in depth with TAGS_SCHEMA
            'anyOf': [
                {'type': 'object'},
                PAIRS,
            ]
        },
        'environment': {
            'type': 'string',
            'maxLength': 64,
        },
        'modules': {'type': 'object'},
        'extra': {'type': 'object'},
        'fingerprint': {
            'type': 'array',
            'items': {'type': 'string'},
        },
        'time_spent': {
            'type': 'number',
            'maximum': BoundedIntegerField.MAX_VALUE,
            'minimum': 0,
        },

        # Exceptions:
        'exception': {},  # EXCEPTION_INTERFACE_SCHEMA,
        'sentry.interfaces.Exception': {},  # EXCEPTION_INTERFACE_SCHEMA,

        # Messages:
        # 'message' is not an alias for the sentry.interfaces.Message interface
        # but instead is a raw string that will be wrapped in a Message interface
        'message': {'type': 'string'},
        'logentry': {},  # MESSAGE_INTERFACE_SCHEMA,
        'sentry.interfaces.Message': {},  # MESSAGE_INTERFACE_SCHEMA,

        # Templates:
        'template': {},  # TEMPLATE_INTERFACE_SCHEMA,
        'sentry.interfaces.Template': {},  # TEMPLATE_INTERFACE_SCHEMA,

        # Other interfaces
        'sentry.interfaces.User': {'type': 'object'},
        'sentry.interfaces.Http': {},

        # Other reserved keys. (some are added in processing)
        'project': {'type': 'number'},
        'errors': {'type': 'array'},
        'checksum': {},
        'site': {},
        'received': {},
    },
    'required': ['platform', 'event_id'],
    'additionalProperties': True,
}
"""
Schemas for raw request data.

This is to validate input data at the very first stage of ingestion. It can
then be transformed into the requisite interface.
"""
INPUT_SCHEMAS = {
    'event': EVENT_SCHEMA,  # Not an interface per se, but the main store API input.
}

"""
Schemas for interfaces.

Data returned by interface.to_json() or passed into interface.to_python()
should conform to these schemas. Currently this is not enforced everywhere yet.
"""
INTERFACE_SCHEMAS = {
    # These should match SENTRY_INTERFACES keys
    'sentry.interfaces.Http': HTTP_INTERFACE_SCHEMA,
    'request': HTTP_INTERFACE_SCHEMA,
    'exception': EXCEPTION_INTERFACE_SCHEMA,
    'sentry.interfaces.Exception': EXCEPTION_INTERFACE_SCHEMA,
    'stacktrace': STACKTRACE_INTERFACE_SCHEMA,
    'sentry.interfaces.Stacktrace': STACKTRACE_INTERFACE_SCHEMA,
    'frame': FRAME_INTERFACE_SCHEMA,  # Not listed in SENTRY_INTERFACES
    'logentry': MESSAGE_INTERFACE_SCHEMA,
    'sentry.interfaces.Message': MESSAGE_INTERFACE_SCHEMA,
    'template': TEMPLATE_INTERFACE_SCHEMA,
    'sentry.interfaces.Template': TEMPLATE_INTERFACE_SCHEMA,
}


def is_valid_input(data, interface):
    if interface not in INPUT_SCHEMAS:
        return True
    return jsonschema.Draft4Validator(
        INPUT_SCHEMAS[interface],
        types={'array': (list, tuple)},
        format_checker=jsonschema.FormatChecker(),
    ).is_valid(data)


def is_valid_interface(data, interface):
    if interface not in INTERFACE_SCHEMAS:
        return True
    return jsonschema.Draft4Validator(
        INTERFACE_SCHEMAS[interface],
        types={'array': (list, tuple)},  # treat python tuples as arrays
        format_checker=jsonschema.FormatChecker(),
    ).is_valid(data)


def validate_and_default_from_schema(data, schema, name=None, strip_nones=True):
    """
    Modify data to conform to schema.

    Takes the object in `data` and checks it against `schema`,
    removing or defaulting any keys that do not pass validation
    and adding defaults for any keys that are required by (and
    have a default value in) the schema.

    This functon does not guarantee that the resulting data will
    validate against the schema. For example, if there were
    required keys missing that had no default in the schema.

    Returns a list of the validation errors encountered.
    """

    errors = []

    if strip_nones and isinstance(data, dict):
        for k in data.keys():
            if data[k] is None:
                del data[k]

    validator = jsonschema.Draft4Validator(
        schema,
        types={'array': (list, tuple)},
        format_checker=jsonschema.FormatChecker(),
    )
    val_errors = validator.iter_errors(data)
    keyed_errors = reversed([e for e in val_errors if len(e.path)])
    # TODO raise any non-keyed errors? (eg disallowed keys)

    # Values that need to be defaulted or deleted because they are not valid.
    for key, group in groupby(keyed_errors, lambda e: e.path[0]):
        ve = six.next(group)
        errors.append({
            'type': EventError.VALUE_TOO_LONG if ve.validator.startswith('max') else EventError.INVALID_DATA,
            'name': name or key,
            'value': data[key],
        })

        if 'default' in ve.schema:
            default = ve.schema['default']
            data[key] = default() if callable(default) else default
        else:
            del data[key]

    # Values that are missing entirely, but are required and should be defaulted
    if 'properties' in schema and 'required' in schema and isinstance(data, dict):
        for p in schema['required']:
            if p not in data:
                if p in schema['properties'] and 'default' in schema['properties'][p]:
                    default = schema['properties'][p]['default']
                    data[p] = default() if callable(default) else default
                else:
                    errors.append({
                        'type': EventError.MISSING_ATTRIBUTE,
                        'name': p,
                    })

    return errors
