from __future__ import absolute_import

from sentry.lang.native.utils import get_sdk_from_event


def test_get_sdk_from_event():
    sdk_info = get_sdk_from_event({
        'debug_meta': {
            'sdk_info': {
                'dsym_type': 'macho',
                'sdk_name': 'iOS',
                'version_major': 9,
                'version_minor': 3,
                'version_patchlevel': 0,
            }
        }
    })
    assert sdk_info['dsym_type'] == 'macho'
    assert sdk_info['sdk_name'] == 'iOS'
    assert sdk_info['version_major'] == 9
    assert sdk_info['version_minor'] == 3
    assert sdk_info['version_patchlevel'] == 0

    sdk_info = get_sdk_from_event({
        'contexts': {
            'os': {
                'type': 'os',
                'name': 'iOS',
                'version': '9.3.1.1234',
            }
        }
    })

    assert sdk_info['dsym_type'] == 'macho'
    assert sdk_info['sdk_name'] == 'iOS'
    assert sdk_info['version_major'] == 9
    assert sdk_info['version_minor'] == 3
    assert sdk_info['version_patchlevel'] == 1
