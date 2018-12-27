from __future__ import absolute_import

from sentry.lang.native.utils import get_sdk_from_event, cpu_name_from_data


def test_get_sdk_from_event():
    sdk_info = get_sdk_from_event(
        {
            'debug_meta': {
                'sdk_info': {
                    'sdk_name': 'iOS',
                    'version_major': 9,
                    'version_minor': 3,
                    'version_patchlevel': 0,
                }
            }
        }
    )
    assert sdk_info['sdk_name'] == 'iOS'
    assert sdk_info['version_major'] == 9
    assert sdk_info['version_minor'] == 3
    assert sdk_info['version_patchlevel'] == 0

    sdk_info = get_sdk_from_event(
        {
            'contexts': {
                'os': {
                    'type': 'os',
                    'name': 'iOS',
                    'version': '9.3.1.1234',
                }
            }
        }
    )

    assert sdk_info['sdk_name'] == 'iOS'
    assert sdk_info['version_major'] == 9
    assert sdk_info['version_minor'] == 3
    assert sdk_info['version_patchlevel'] == 1


def test_cpu_name_from_data():
    cpu_name = cpu_name_from_data(
        {
            'contexts': {
                'device': {
                    'type': 'device',
                    'arch': 'arm64'
                },
                'device2': {
                    'type': 'device',
                    'arch': 'arm7'
                },
            }
        }
    )

    assert cpu_name == 'arm64'


def test_cpu_name_from_data_inferred_type():
    cpu_name = cpu_name_from_data(
        {
            'contexts': {
                'some_device': {
                    'type': 'device',
                    'arch': 'arm64'
                }
            }
        }
    )

    assert cpu_name == 'arm64'
