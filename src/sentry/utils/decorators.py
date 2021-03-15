class classproperty:
    # Vendored from newer Django:
    # https://github.com/django/django/blob/1.9.6/django/utils/decorators.py#L188-L197
    def __init__(self, method=None):
        self.fget = method

    def __get__(self, instance, owner):
        return self.fget(owner)

    def getter(self, method):
        self.fget = method
        return self
