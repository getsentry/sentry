class ServerlessMixin:
    def get_serverless_functions(self) -> list[dict[str, object]]:
        """
        Returns a list of serverless functions
        """
        raise NotImplementedError

    def enable_function(self, target: str) -> dict[str, object]:
        raise NotImplementedError

    def disable_function(self, target: str) -> dict[str, object]:
        raise NotImplementedError

    def update_function_to_latest_version(self, target: str) -> dict[str, object]:
        raise NotImplementedError
