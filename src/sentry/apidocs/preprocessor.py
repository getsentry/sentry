PUBLIC_ENDPOINTS = {}

# need to import extensions here so preprocessor knows they exist when ran
from sentry.apidocs.extensions import *  # NOQA


def custom_preprocessing_hook(endpoints):  # TODO: organize method, rename
    filtered = []
    for (path, path_regex, method, callback) in endpoints:

        if (
            callback.__name__ in PUBLIC_ENDPOINTS
            and method in PUBLIC_ENDPOINTS[callback.__name__]["methods"]
        ):
            filtered.append((path, path_regex, method, callback))

    return filtered
