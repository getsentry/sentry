from .preprocessor import PUBLIC_ENDPOINTS


def declare_public(methods):
    def decorate(view_cls):
        PUBLIC_ENDPOINTS[view_cls.__name__] = {
            "callback": view_cls,
            "methods": methods,
        }

        return view_cls

    return decorate
