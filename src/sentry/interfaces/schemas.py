"""
sentry.interfaces.schemas
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import six
import jsonschema

from sentry.constants import VALID_PLATFORMS

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
        'date-time': {'type': 'string', },  # TODO formate datetime (RFC3339)
        'hostname': {'type': 'string'},
        'port': {'type': 'number'},
        'effective-expiration-date': {'type': 'string', },  # TODO formate datetime (RFC3339)
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

"""
Schemas for raw request data.

This is to validate input data at the very first stage of ingestion. It can
then be transformed into the requisite interface.
"""
INPUT_SCHEMAS = {
    # These should match SENTRY_INTERFACES keys
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
    'frame': FRAME_INTERFACE_SCHEMA,
}


def is_valid_input(data, interface):
    if interface in INPUT_SCHEMAS:
        try:
            jsonschema.validate(data, INPUT_SCHEMAS[interface])
        except jsonschema.ValidationError:
            return False
    return True


def is_valid_interface(data, interface):
    if interface in INTERFACE_SCHEMAS:
        try:
            jsonschema.validate(data, INTERFACE_SCHEMAS[interface])
        except jsonschema.ValidationError:
            return False
    return True
