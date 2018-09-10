from __future__ import absolute_import

from django.conf import settings


def get_browser_sdk_version_choices():
    # TODO(hazat): do request here to api to fetch versions
    return (('latest', 'latest'), ('4.x', '4.x'), )


def get_browser_sdk_version(project_key):
    return project_key.data.get('browserSdkVersion', settings.JS_SDK_LOADER_SDK_VERSION),
