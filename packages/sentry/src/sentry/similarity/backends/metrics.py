from sentry.similarity.backends.abstract import AbstractIndexBackend
from sentry.utils.metrics import timer


class MetricsWrapper(AbstractIndexBackend):
    def __init__(self, backend, template="similarity.{}", scope_tag_name="scope"):
        self.backend = backend
        self.template = template
        self.scope_tag_name = scope_tag_name

    def __getattr__(self, name):
        return getattr(self.backend, name)

    def __instrumented_method_call(self, method, scope, *args, **kwargs):
        tags = {}
        if self.scope_tag_name is not None:
            tags[self.scope_tag_name] = scope

        with timer(self.template.format(method), tags=tags):
            return getattr(self.backend, method)(scope, *args, **kwargs)

    def record(self, *args, **kwargs):
        return self.__instrumented_method_call("record", *args, **kwargs)

    def classify(self, *args, **kwargs):
        return self.__instrumented_method_call("classify", *args, **kwargs)

    def compare(self, *args, **kwargs):
        return self.__instrumented_method_call("compare", *args, **kwargs)

    def merge(self, *args, **kwargs):
        return self.__instrumented_method_call("merge", *args, **kwargs)

    def delete(self, *args, **kwargs):
        return self.__instrumented_method_call("delete", *args, **kwargs)

    def scan(self, *args, **kwargs):
        return self.__instrumented_method_call("scan", *args, **kwargs)

    def flush(self, *args, **kwargs):
        return self.__instrumented_method_call("flush", *args, **kwargs)

    def export(self, *args, **kwargs):
        return self.__instrumented_method_call("export", *args, **kwargs)

    def import_(self, *args, **kwargs):
        return self.__instrumented_method_call("import_", *args, **kwargs)
