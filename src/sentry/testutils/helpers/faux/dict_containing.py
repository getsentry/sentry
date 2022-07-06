class DictContaining:
    def __init__(self, *args, **kwargs):
        if len(args) == 1 and isinstance(args[0], dict):
            self.args = []
            self.kwargs = args[0]
        else:
            self.args = args
            self.kwargs = kwargs

    def __eq__(self, other):
        return self._args_match(other) and self._kwargs_match(other)

    def _args_match(self, other):
        for key in self.args:
            if key not in other:
                return False
        return True

    def _kwargs_match(self, other):
        for key, value in self.kwargs.items():
            if self.kwargs[key] != other[key]:
                return False
        return True
