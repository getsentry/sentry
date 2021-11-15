PUBLIC_ENDPOINTS = {}


def custom_preprocessing_hook(endpoints):
    # your modifications to the list of operations that are exposed in the schema
    filtered = []
    for (path, path_regex, method, callback) in endpoints:

        if (
            callback.__name__ in PUBLIC_ENDPOINTS
            and method in PUBLIC_ENDPOINTS[callback.__name__]["methods"]
        ):
            filtered.append((path, path_regex, method, callback))

    return filtered
