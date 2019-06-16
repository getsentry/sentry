from __future__ import absolute_import

from sentry.sdk_updates import SdkSetupState, SdkIndexState, get_suggested_updates


PYTHON_INDEX_STATE = SdkIndexState(
    sdk_versions={"sentry.python": "0.9.0"},
)


def test_too_old_django():
    setup = SdkSetupState(
        sdk_name='sentry.python',
        sdk_version='0.9.0',
        integrations=[],
        modules={
            'django': '1.3'})
    assert list(get_suggested_updates(setup, PYTHON_INDEX_STATE)) == []


def test_too_old_sdk():
    setup = SdkSetupState(
        sdk_name='sentry.python',
        sdk_version='0.1.0',
        integrations=[],
        modules={
            'django': '1.8'})
    assert list(get_suggested_updates(setup, PYTHON_INDEX_STATE)) == [
        {
            'enables': [
                {
                    'type': 'enableIntegration',
                    'enables': [],
                    'integrationName': 'django',
                    'integrationUrl': 'https://docs.sentry.io/platforms/python/django/',
                }
            ],
            'newSdkVersion': '0.9.0',
            'sdkName': 'sentry.python',
            'sdkUrl': None,
            'type': 'updateSdk'
        }
    ]


def test_enable_django_integration():
    setup = SdkSetupState(
        sdk_name='sentry.python',
        sdk_version='0.9.0',
        integrations=[],
        modules={
            'django': '1.8'})
    assert list(get_suggested_updates(setup, PYTHON_INDEX_STATE)) == [
        {
            'type': 'enableIntegration',
            'enables': [],
            'integrationName': 'django',
            'integrationUrl': 'https://docs.sentry.io/platforms/python/django/',
        }
    ]


def test_update_sdk():
    setup = SdkSetupState(
        sdk_name='sentry.python',
        sdk_version='0.1.0',
        integrations=[],
        modules={})
    assert list(get_suggested_updates(setup, PYTHON_INDEX_STATE)) == [
        {
            'enables': [],
            'newSdkVersion': '0.9.0',
            'sdkName': 'sentry.python',
            'sdkUrl': None,
            'type': 'updateSdk'
        }
    ]


def test_enable_two_integrations():
    setup = SdkSetupState(
        sdk_name='sentry.python',
        sdk_version='0.1.0',
        integrations=[],
        modules={"django": "1.8.0", "flask": "1.0.0"})

    assert list(get_suggested_updates(setup, PYTHON_INDEX_STATE)) == [
        {
            'enables': [
                {
                    'type': 'enableIntegration',
                    'enables': [],
                    'integrationName': 'django',
                    'integrationUrl': 'https://docs.sentry.io/platforms/python/django/',
                },
                {
                    'type': 'enableIntegration',
                    'enables': [],
                    'integrationName': 'flask',
                    'integrationUrl': 'https://docs.sentry.io/platforms/python/flask/',
                }
            ],
            'newSdkVersion': '0.9.0',
            'sdkName': 'sentry.python',
            'sdkUrl': None,
            'type': 'updateSdk'
        }
    ]
