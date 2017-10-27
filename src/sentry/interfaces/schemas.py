"""
sentry.interfaces.schemas
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import six
import jsonschema
import uuid

from sentry.db.models import BoundedIntegerField
from sentry.constants import (
    LOG_LEVELS_MAP,
    MAX_TAG_KEY_LENGTH,
    MAX_TAG_VALUE_LENGTH,
    MAX_CULPRIT_LENGTH,
    VALID_PLATFORMS,
)
from sentry.tagstore.base import INTERNAL_TAG_KEYS

CSP_SCHEMA = {
    'type': 'object',
    'properties': {
        'csp-report': {
            'type': 'object',
            'properties': {
                'effective-directive': {
                    'type': 'string',
                    'enum': [
                        'base-uri',
                        'child-src',
                        'connect-src',
                        'default-src',
                        'font-src',
                        'form-action',
                        'frame-ancestors',
                        'img-src',
                        'manifest-src',
                        'media-src',
                        'object-src',
                        'plugin-types',
                        'referrer',
                        'script-src',
                        'style-src',
                        'upgrade-insecure-requests',
                        # 'frame-src', # Deprecated (https://developer.mozilla.org/en-US/docs/Web/Security/CSP/CSP_policy_directives#frame-src)
                        # 'sandbox', # Unsupported
                    ],
                },
                'blocked-uri': {
                    'type': 'string',
                    'default': 'self',  # TODO test that this works and does not interfere with required keys?
                    'not': {
                        'enum': [
                            'about',  # Noise from Chrome about page.
                            'ms-browser-extension',
                        ],
                        'description': "URIs that are pure noise and will never be actionable.",
                    }
                },
                'document-uri': {
                    'type': 'string',
                    'not': {'enum': ['about:blank']}
                },
                'original-policy': {'type': 'string'},
                'referrer': {'type': 'string', 'default': ''},
                'status-code': {'type': 'number'},
                'violated-directive': {'type': 'string', 'default': ''},
                'source-file': {'type': 'string'},
                'line-number': {'type': 'number'},
                'column-number': {'type': 'number'},
                'script-sample': {'type': 'number'},  # Firefox specific key.
            },
            'allOf': [
                {'required': ['effective-directive']},
                {
                    'anyOf': [  # Require at least one of these keys.
                        {'required': ['blocked-uri']},
                        {'required': ['source-file']},
                    ]
                }
            ],
            'additionalProperties': False,  # Don't allow any other keys.
        }
    },
    'required': ['csp-report'],
    'additionalProperties': False,
}

CSP_INTERFACE_SCHEMA = {
    'type': 'object',
    'properties': {k.replace('-', '_'): v for k, v in six.iteritems(CSP_SCHEMA['properties']['csp-report']['properties'])},
    'allOf': [
        {'required': ['effective_directive']},
        {
            'anyOf': [
                # At least one of these is required.
                {'required': ['blocked_uri']},
                {'required': ['source_file']},
            ]
        }
    ],
    'additionalProperties': False,  # Don't allow any other keys.
}

# RFC7469 Section 3
HPKP_SCHEMA = {
    'type': 'object',
    'properties': {
        'date-time': {'type': 'string', 'format': 'date-time'},
        'hostname': {'type': 'string'},
        'port': {'type': 'number'},
        'effective-expiration-date': {'type': 'string', 'format': 'date-time'},
        'include-subdomains': {'type': 'boolean'},
        'noted-hostname': {'type': 'string'},
        'served-certificate-chain': {
            'type': 'array',
            'items': {'type': 'string'}
        },
        'validated-certificate-chain': {
            'type': 'array',
            'items': {'type': 'string'}
        },
        'known-pins': {
            'type': 'array',
            'items': {'type': 'string'}  # TODO regex this string for 'pin-sha256="ABC123"' syntax
        },
    },
    'required': ['hostname'],  # TODO fill in more required keys
    'additionalProperties': False,  # Don't allow any other keys.
}

HPKP_INTERFACE_SCHEMA = {
    'type': 'object',
    'properties': {k.replace('-', '_'): v for k, v in six.iteritems(HPKP_SCHEMA['properties'])},
    'required': ['hostname'],  # TODO fill in more required keys
    'additionalProperties': False,  # Don't allow any other keys.
}

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
        'url': {'type': 'string'},
        'method': {'type': 'string'},
        'query_string': {
            'anyOf': [
                {'type': 'string'},
                {'type': 'object'},
            ],
        },
        'inferred_content_type': {'type': 'string'},
        'cookies': {
            'anyOf': [
                {'type': 'object'},  # either an object
                {'type': 'string'},  # or a query string
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
        'data': {
            'anyOf': [
                {'type': 'string'},
                {'type': 'object'},
            ],
        },
        'fragment': {'type': 'string'},
    },
    'required': ['url'],
    'additionalProperties': False,  # Don't allow any other keys.
}

FRAME_INTERFACE_SCHEMA = {
    'type': 'object',
    'properties': {
        'abs_path': {'type': 'string'},
        'colno': {'type': 'number'},
        'context_line': {'type': 'string'},
        'data': {
            'anyOf': [
                {'type': 'object'},
                PAIRS,
            ]
        },
        'errors': {},
        'filename': {
            'anyOf': [
                {'type': 'string'},
                {'type': 'null'},
            ],
        },
        'function': {'type': 'string'},
        'image_addr': {},
        'in_app': {
            'anyOf': [
                {'type': 'boolean', 'default': False},
                {'type': 'null'},
            ],
        },
        'instruction_addr': {},
        'lineno': {'type': 'number'},
        'module': {'type': 'string'},
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
            'items': FRAME_INTERFACE_SCHEMA,
            'minItems': 1,
        },
        'frames_omitted': {
            'anyOf': [
                {
                    'type': 'array',
                    'maxItems': 2,
                    'minItems': 2,
                    'items': {'type': 'number'}
                },
                {'type': 'null'},
            ],
        },
        'registers': {
            'anyOf': [
                {'type': 'object'},
                {'type': 'null'},
            ],
        }
    },
    'required': ['frames'],
    'additionalProperties': False,
}

EXCEPTION_INTERFACE_SCHEMA = {
    'type': 'object',
    'properties': {
        'type': {'type': 'string'},
        'value': {},  # any type
        'module': {'type': 'string'},
        'mechanism': {
            'anyOf': [
                {'type': 'object'},
                {'type': 'null'},
            ],
        },
        'stacktrace': {
            'anyOf': [
                STACKTRACE_INTERFACE_SCHEMA,
                {'type': 'null'},
                {
                    # The code allows for the possibility of an empty
                    # {"frames":[]} object, this sucks and should go.
                    'type': 'object',
                    'properties': {
                        'frames': {'type': 'array', 'maxItems': 0},
                    },
                },
            ],
        },
        'thread_id': {},
        'raw_stacktrace': {
            'anyOf': [
                STACKTRACE_INTERFACE_SCHEMA,
                {'type': 'null'},
                {
                    # The code allows for the possibility of an empty
                    # {"frames":[]} object, this sucks and should go.
                    'type': 'object',
                    'properties': {
                        'frames': {'type': 'array', 'maxItems': 0},
                    },
                },
            ],
        },
    },
    'anyOf': [  # Require at least one of these keys.
        {'required': ['type']},
        {'required': ['value']},
    ],
    'additionalProperties': False,  # Don't allow any other keys.
}

TEMPLATE_INTERFACE_SCHEMA = {'type': 'object'}  # TODO fill this out
MESSAGE_INTERFACE_SCHEMA = {'type': 'object'}  # TODO fill this out

TAGS_DICT_SCHEMA = {
    'allOf': [
        {
            'type': 'object',
            # TODO with draft 6 support, we can just use propertyNames/maxLength
            'patternProperties': {
                '^[a-zA-Z0-9_\.:-]{1,%d}$' % MAX_TAG_KEY_LENGTH: {
                    # TODO numbers as tag values?
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
                'pattern': '^[^\n]+\Z',  # \Z because $ matches before a trailing newline
                'maxLength': MAX_TAG_VALUE_LENGTH,
            },
        ]
    }
}

TAGS_SCHEMA = {
    'anyOf': [TAGS_DICT_SCHEMA, TAGS_TUPLES_SCHEMA]
}

STORE_SCHEMA = {
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
        'sdk': {'type': 'string'},

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
            'minLength': 1,
            'maxLength': MAX_CULPRIT_LENGTH,
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
            'minimum': 1,
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
        'sentry.interfaces.User': {},
        'sentry.interfaces.Http': {},

        # Other reserved keys. (some are added in processing)
        'project': {'type': 'number'},
        'errors': {'type': 'array'},
        'checksum': {},
        'site': {},
        'received': {},
    },
    'required': ['platform', 'event_id', 'timestamp'],
    'additionalProperties': True,
}
"""
Schemas for raw request data.

This is to validate input data at the very first stage of ingestion. It can
then be transformed into the requisite interface.
"""
INPUT_SCHEMAS = {
    'store': STORE_SCHEMA,  # Not an interface per se, but the main store API input.
    'sentry.interfaces.Csp': CSP_SCHEMA,
    'hpkp': HPKP_SCHEMA,
}

"""
Schemas for interfaces.

Data returned by interface.to_json() or passed into interface.to_python()
should conform to these schemas. Currently this is not enforced everywhere yet.
"""
INTERFACE_SCHEMAS = {
    # These should match SENTRY_INTERFACES keys
    'sentry.interfaces.Csp': CSP_INTERFACE_SCHEMA,
    'hpkp': HPKP_INTERFACE_SCHEMA,
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
    if interface in INPUT_SCHEMAS:
        return jsonschema.Draft3Validator(
            INPUT_SCHEMAS[interface],
            types={'array': (list, tuple)},
            format_checker=jsonschema.FormatChecker(),  # TODO check this works for date-time
        ).is_valid(data)
    return True


def is_valid_interface(data, interface):
    if interface in INTERFACE_SCHEMAS:
        return jsonschema.Draft3Validator(
            INTERFACE_SCHEMAS[interface],
            types={'array': (list, tuple)},  # treat python tuples as arrays
            format_checker=jsonschema.FormatChecker(),
        ).is_valid(data)
    return True
