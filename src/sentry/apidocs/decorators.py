from .preprocessor import PUBLIC_ENDPOINTS


def declare_public(methods):
    def decorate(view_cls):
        PUBLIC_ENDPOINTS[view_cls.__name__] = {
            "methods": methods,
        }

        return view_cls

    return decorate
