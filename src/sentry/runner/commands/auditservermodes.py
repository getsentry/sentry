from __future__ import annotations

import abc
from collections import defaultdict

import click
import django.apps
import django.urls


@click.command()
def auditservermodes():
    """Lists which classes have had server mode decorators applied."""

    from sentry.runner import configure

    configure()
    ModelPresentation().print_table(create_model_table())
    ViewPresentation().print_table(create_view_table())


def create_model_table():
    table = defaultdict(list)
    for model_class in django.apps.apps.get_models():
        if model_class._meta.app_label != "sentry":
            continue
        limit = getattr(model_class._meta, "_ModelAvailableOn__mode_limit", None)
        key = (limit.modes, limit.read_only) if limit else (frozenset(), frozenset())
        table[key].append(model_class)
    return table


def create_view_table():
    from sentry.api.base import Endpoint

    def is_endpoint(view_function, bindings):
        view_class = getattr(view_function, "view_class", None)
        return view_class and issubclass(view_class, Endpoint)

    def get_view_classes():
        url_mappings = list(django.urls.get_resolver().reverse_dict.items())
        for (view_function, bindings) in url_mappings:
            if is_endpoint(view_function, bindings):
                yield view_function.view_class

    table = defaultdict(list)
    for view_class in get_view_classes():
        limit = getattr(view_class, "__mode_limit", None)
        key = limit.modes if limit else frozenset()
        table[key].append(view_class)

    return table


class ConsolePresentation(abc.ABC):
    @property
    @abc.abstractmethod
    def table_header(self):
        raise NotImplementedError

    @abc.abstractmethod
    def order(self, group):
        raise NotImplementedError

    @abc.abstractmethod
    def get_group_header(self, key):
        raise NotImplementedError

    def format_mode_set(self, modes):
        names = sorted(str(x) for x in modes)
        return repr(names)

    def format_value(self, value):
        return f"{value.__module__}.{value.__name__}"

    def print_table(self, table):
        print("\n" + self.table_header)  # noqa
        print("=" * len(self.table_header), end="\n\n")  # noqa

        groups = list(table.items())
        groups.sort(key=self.order)

        for (group_key, group) in groups:
            group_header = self.get_group_header(group_key)
            print(group_header)  # noqa
            print("-" * len(group_header), end="\n\n")  # noqa

            values = sorted(self.format_value(value) for value in group)
            for value in values:
                print("  - " + value)  # noqa
            print()  # noqa


class ModelPresentation(ConsolePresentation):
    @property
    def table_header(self):
        return "MODELS"

    def order(self, group):
        group_key, _model_group = group
        write_modes, read_modes = group_key
        return (
            len(write_modes),
            len(read_modes),
            self.format_mode_set(write_modes),
            self.format_mode_set(read_modes),
        )

    def get_group_header(self, key):
        write_modes, read_modes = key
        if write_modes:
            if read_modes:
                return f"{self.format_mode_set(write_modes)}, read_only={self.format_mode_set(read_modes)}"
            else:
                return self.format_mode_set(write_modes)
        else:
            return "No decorator"


class ViewPresentation(ConsolePresentation):
    @property
    def table_header(self):
        return "ENDPOINTS"

    def order(self, group):
        mode_set, _view_group = group
        return len(mode_set), self.format_mode_set(mode_set)

    def get_group_header(self, key):
        return self.format_mode_set(key) if key else "No decorator"
