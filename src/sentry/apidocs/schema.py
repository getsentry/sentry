from drf_spectacular.openapi import AutoSchema


class SentryDocSchema(AutoSchema):
    @property
    def view_func(self):
        return getattr(self.view, self.method.lower(), None)

    def get_override_parameters(self):
        """
        we need to extract
        """
        if self.view_func is not None:
            return getattr(self.view_func, "query_params", [])
        return super().get_override_parameters()

    def get_response_serializers(self):
        if self.view_func is not None:
            return getattr(self.view_func, "response_serializer")
        return super().get_response_serializers()

    def get_operation_id(self):
        if self.view_func is not None and getattr(
            self.view_func, "get_description_from_doc", False
        ):
            return self.view_func.__doc__.strip().splitlines()[0]
        return super().get_operation_id()

    def get_description(self):
        if self.view_func is not None and getattr(
            self.view_func, "get_description_from_doc", False
        ):
            description = " ".join(self.view_func.__doc__.strip().splitlines()[1:])
            return description.strip()
        return super().get_description()
