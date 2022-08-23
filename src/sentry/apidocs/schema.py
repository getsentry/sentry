from drf_spectacular.openapi import AutoSchema


class SentryDocSchema(AutoSchema):
    def get_override_parameters(self):
        """
        we need to extract
        """
        view_func = getattr(self.view, self.method.lower(), None)
        if view_func is not None:
            return getattr(view_func, "query_params", [])
        return []
