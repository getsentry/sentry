class ServerlessMixin:
    def get_serverless_functions(self):
        """
        Returns a list of serverless functions
        """
        raise NotImplementedError

    def enable_function(self, target):
        raise NotImplementedError

    def disable_function(self, target):
        raise NotImplementedError

    def update_function_to_latest_version(self, target):
        raise NotImplementedError
