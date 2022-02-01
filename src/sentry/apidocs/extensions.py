from drf_spectacular.extensions import OpenApiAuthenticationExtension


class TokenAuthExtension(OpenApiAuthenticationExtension):
    target_class = "sentry.api.authentication.TokenAuthentication"
    name = "auth_token"

    def get_security_definition(self, auto_schema):
        return {"type": "http", "scheme": "bearer"}

    def get_security_requirement(self, auto_schema):
        permissions = set()
        # TODO: resolve duplicates
        for permission in auto_schema.view.get_permissions():
            for p in permission.scope_map.get(auto_schema.method, []):
                permissions.add(p)

        return {self.name: list(permissions)}
