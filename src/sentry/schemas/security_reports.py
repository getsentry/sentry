from __future__ import absolute_import

# NB this schema validates the version of the CSP report we create after
# validate_data() which changes hyphens to underscores in the key names.

CSP_POLICY_VIOLATION_REPORT_SCHEMA = {
    'type': 'object',
    'properties': {
        'effective_directive': {
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
        'blocked_uri': {
            'type': 'string',
            'not': {
                'enum': [
                    'about',  # Noise from Chrome about page.
                    'ms-browser-extension',
                ],
                'description': "URIs that are pure noise and will never be actionable.",
            }
        },
        'document_uri': {'type': 'string'},
        'original_policy': {'type': 'string'},
        'referrer': {'type': 'string'},
        'status_code': {'type': 'number'},
        'violated_directive': {'type': 'string'},
        'source_file': {'type': 'string'},
        'line_number': {'type': 'number'},
        'column_number': {'type': 'number'},
    },
    'allOf': [
        {'required': ['effective_directive']},
        {
            'anyOf': [  # Require at least one of these keys.
                {'required': ['blocked_uri']},
                {'required': ['source_file']},
            ]
        }
    ],
    'additionalProperties': False,  # Don't allow any other keys.
}

SCHEMAS = {
    'csp': CSP_POLICY_VIOLATION_REPORT_SCHEMA,
    'hpkp': {},
    'expect-ct': {},
    'expect-staple': {},
}
