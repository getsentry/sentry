from __future__ import absolute_import

from sentry.lang.native.utils import get_sdk_from_event, cpu_name_from_data, \
    version_build_from_data


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


def test_cpu_name_from_data():
    cpu_name = cpu_name_from_data({
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
    })

    assert cpu_name == 'arm64'


def test_version_build_from_data():

    app_info = version_build_from_data({
        'contexts': {
            'app': {
                'app_build': "2",
                'device_app_hash': "18482a73f96d2ed3f4ce8d73fa9942744bff3598",
                'app_id': "45BA82DF-F3E3-37F7-9D88-12A1AAB719E7",
                'app_version': "1.0",
                'app_identifier': "com.rokkincat.SentryExample",
                'app_name': "SwiftExample",
                'app_start_time': "2017-03-28T15:14:01Z",
                'type': "app",
                'build_type': "simulator"
            }
        }
    })
    assert app_info.version == '1.0'
    assert app_info.build == '2'
    assert app_info.name == 'SwiftExample'
    assert app_info.id == 'com.rokkincat.SentryExample'

    app_info = version_build_from_data({
        'contexts': {
            'app': {
                'device_app_hash': "18482a73f96d2ed3f4ce8d73fa9942744bff3598",
                'app_id': "45BA82DF-F3E3-37F7-9D88-12A1AAB719E7",
                'app_version': "1.0",
                'app_identifier': "com.rokkincat.SentryExample",
                'app_name': "SwiftExample",
                'app_start_time': "2017-03-28T15:14:01Z",
                'type': "app",
                'build_type': "simulator"
            }
        }
    })
    assert app_info is None

    app_info = version_build_from_data({
        'contexts': {
            'app': {
                'device_app_hash': "18482a73f96d2ed3f4ce8d73fa9942744bff3598",
                'app_id': "45BA82DF-F3E3-37F7-9D88-12A1AAB719E7",
                'app_identifier': "com.rokkincat.SentryExample",
                'app_name': "SwiftExample",
                'app_start_time': "2017-03-28T15:14:01Z",
                'type': "app",
                'build_type': "simulator"
            }
        }
    })
    assert app_info is None

    app_info = version_build_from_data({
        'contexts': {
            'bal': {
                'device_app_hash': "18482a73f96d2ed3f4ce8d73fa9942744bff3598",
            }
        }
    })
    assert app_info is None


def test_cpu_name_from_data_inferred_type():
    cpu_name = cpu_name_from_data({
        'contexts': {
            'some_device': {
                'type': 'device',
                'arch': 'arm64'
            }
        }
    })

    assert cpu_name == 'arm64'
