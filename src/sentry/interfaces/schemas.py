"""
sentry.interfaces.schemas
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from functools32 import lru_cache
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
    VERSION_LENGTH,
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
        'instruction_offset': {},
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
        'project_root': {},
        'symbol': {'type': 'string'},
        'symbol_addr': {},
        'vars': {
            'anyOf': [
                {'type': ['object', 'array']},
                PAIRS,
            ]
        },
    },
    # `additionalProperties: {'not': {}}` forces additional properties to
    # individually fail with errors that identify the key, so they can be deleted.
    'additionalProperties': {'not': {}},
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
    # `additionalProperties: {'not': {}}` forces additional properties to
    # individually fail with errors that identify the key, so they can be deleted.
    'additionalProperties': {'not': {}},
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

DEVICE_INTERFACE_SCHEMA = {
    'type': 'object',
    'properties': {
        'name': {
            'type': 'string',
            'minLength': 1,
        },
        'version': {
            'type': 'string',
            'minLength': 1,
        },
        'build': {},
        'data': {
            'type': 'object',
            'default': {},
        },
    },
    'required': ['name', 'version'],
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
                    'minLength': 1,
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
                'minLength': 1,
                'maxLength': MAX_TAG_KEY_LENGTH,
                'not': {
                    'pattern': '^(%s)$' % '|'.join(INTERNAL_TAG_KEYS),
                },
            },
            # Value
            {
                'type': 'string',
                'pattern': '^[^\n]*\Z',  # \Z because $ matches before a trailing newline
                'minLength': 1,
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
        'type': {
            'type': 'string',
        },
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
        'logger': {
            'type': 'string',
            'pattern': r'^[^\r\n]*\Z',  # \Z because $ matches before a trailing newline
            'default': '',
        },
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
            'maxLength': VERSION_LENGTH,
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
        'project': {'type': ['number', 'string']},
        'key_id': {},
        'errors': {'type': 'array'},
        'checksum': {},
        'site': {},
        'received': {},
    },
    'required': ['platform', 'event_id'],
    'additionalProperties': True,
}

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
        'date-time': {'type': 'string', },  # TODO validate (RFC3339)
        'hostname': {'type': 'string'},
        'port': {'type': 'number'},
        'effective-expiration-date': {'type': 'string', },  # TODO validate (RFC3339)
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

EXPECT_CT_SCHEMA = {
    'type': 'object',
    'properties': {
        'expect-ct-report': {
            'type': 'object',
            'properties': {
                'date-time': {'type': 'string', },  # TODO validate (RFC3339)
                'hostname': {'type': 'string'},
                'port': {'type': 'number'},
                'effective-expiration-date': {'type': 'string', },  # TODO validate (RFC3339)
                'served-certificate-chain': {
                    'type': 'array',
                    'items': {'type': 'string'}
                },
                'validated-certificate-chain': {
                    'type': 'array',
                    'items': {'type': 'string'}
                },
                'scts': {
                    'type': 'array',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'version': {'type': 'number'},
                            'status': {
                                'type': 'string',
                                'enum': ['unknown', 'valid', 'invalid'],
                            },
                            'source': {
                                'type': 'string',
                                'enum': ['tls-extension', 'ocsp', 'embedded'],
                            },
                            'serialized_sct': {'type': 'string'},  # Base64
                        },
                        'additionalProperties': False,
                    },
                },
            },
            'required': ['hostname'],
            'additionalProperties': False,
        },
    },
    'additionalProperties': False,
}

EXPECT_CT_INTERFACE_SCHEMA = {
    'type': 'object',
    'properties': {k.replace('-', '_'): v for k, v in
                   six.iteritems(EXPECT_CT_SCHEMA['properties']['expect-ct-report']['properties'])},
    'required': ['hostname'],
    'additionalProperties': False,
}

EXPECT_STAPLE_SCHEMA = {
    'type': 'object',
    'properties': {
        'expect-staple-report': {
            'type': 'object',
            'properties': {
                'date-time': {'type': 'string', },  # TODO validate (RFC3339)
                'hostname': {'type': 'string'},
                'port': {'type': 'number'},
                'effective-expiration-date': {'type': 'string', },  # TODO validate (RFC3339)
                'response-status': {
                    'type': 'string',
                    'enum': [
                        'MISSING',
                        'PROVIDED',
                        'ERROR_RESPONSE',
                        'BAD_PRODUCED_AT',
                        'NO_MATCHING_RESPONSE',
                        'INVALID_DATE',
                        'PARSE_RESPONSE_ERROR',
                        'PARSE_RESPONSE_DATA_ERROR',
                    ],
                },
                'ocsp-response': {},
                'cert-status': {
                    'type': 'string',
                    'enum': [
                        'GOOD',
                        'REVOKED',
                        'UNKNOWN',
                    ],
                },
                'served-certificate-chain': {
                    'type': 'array',
                    'items': {'type': 'string'}
                },
                'validated-certificate-chain': {
                    'type': 'array',
                    'items': {'type': 'string'}
                },
            },
            'required': ['hostname'],
            'additionalProperties': False,
        },
    },
    'additionalProperties': False,
}

EXPECT_STAPLE_INTERFACE_SCHEMA = {
    'type': 'object',
    'properties': {k.replace('-', '_'): v for k, v in
                   six.iteritems(EXPECT_STAPLE_SCHEMA['properties']['expect-staple-report']['properties'])},
    'required': ['hostname'],
    'additionalProperties': False,
}

"""
Schemas for raw request data.

This is to validate input data at the very first stage of ingestion. It can
then be transformed into the requisite interface.
"""
INPUT_SCHEMAS = {
    'sentry.interfaces.Csp': CSP_SCHEMA,
    'hpkp': HPKP_SCHEMA,
    'expectct': EXPECT_CT_SCHEMA,
    'expectstaple': EXPECT_STAPLE_SCHEMA,
}

"""
Schemas for interfaces.

Data returned by interface.to_json() or passed into interface.to_python()
should conform to these schemas. Currently this is not enforced everywhere yet.
"""
INTERFACE_SCHEMAS = {
    # Sentry interfaces
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
    'device': DEVICE_INTERFACE_SCHEMA,
    
    # Security reports
    'sentry.interfaces.Csp': CSP_INTERFACE_SCHEMA,
    'hpkp': HPKP_INTERFACE_SCHEMA,
    'expectct': EXPECT_CT_INTERFACE_SCHEMA,
    'expectstaple': EXPECT_STAPLE_INTERFACE_SCHEMA,

    # Not interfaces per se, but looked up as if they were.
    'event': EVENT_SCHEMA,
    'tags': TAGS_TUPLES_SCHEMA,
}


@lru_cache(maxsize=100)
def validator_for_interface(name):
    if name not in INTERFACE_SCHEMAS:
        return None
    return jsonschema.Draft4Validator(INTERFACE_SCHEMAS[name], types={'array': (list, tuple)})


def validate_and_default_interface(data, interface, name=None,
                                   strip_nones=True, raise_on_invalid=False):
    """
    Modify data to conform to named interface's schema.

    Takes the object in `data` and checks it against the schema for
    `interface`, removing or defaulting any keys that do not pass validation
    and adding defaults for any keys that are required by (and have a default
    value in) the schema.

    Returns whether the resulting modified data is valid against the schema and
    a list of any validation errors encountered in processing.
    """
    is_valid = True
    needs_revalidation = False
    errors = []

    validator = validator_for_interface(interface)
    if validator is None:
        return (True, [])
    schema = validator.schema

    # Strip Nones so we don't have to take null into account for all schemas.
    if strip_nones and isinstance(data, dict):
        for k in data.keys():
            if data[k] is None:
                del data[k]

    # Values that are missing entirely, but are required and should be defaulted
    if 'properties' in schema and 'required' in schema and isinstance(data, dict):
        for p in schema['required']:
            if p not in data:
                if p in schema['properties'] and 'default' in schema['properties'][p]:
                    default = schema['properties'][p]['default']
                    data[p] = default() if callable(default) else default
                else:
                    # TODO raise as shortcut?
                    errors.append({'type': EventError.MISSING_ATTRIBUTE, 'name': p})

    validator_errors = list(validator.iter_errors(data))
    keyed_errors = [e for e in reversed(validator_errors) if len(e.path)]
    if len(validator_errors) > len(keyed_errors):
        needs_revalidation = True

    # Values that need to be defaulted or deleted because they are not valid.
    for key, group in groupby(keyed_errors, lambda e: e.path[0]):
        ve = six.next(group)
        is_max = ve.validator.startswith('max')
        error_type = EventError.VALUE_TOO_LONG if is_max else EventError.INVALID_DATA
        errors.append({'type': error_type, 'name': name or key, 'value': data[key]})

        if 'default' in ve.schema:
            default = ve.schema['default']
            data[key] = default() if callable(default) else default
        else:
            needs_revalidation = True
            del data[key]

    if needs_revalidation:
        is_valid = validator.is_valid(data)

    return is_valid, errors
