from __future__ import annotations

import abc
import sys
from collections import defaultdict

import django.apps
import django.urls

from sentry.utils import json


def audit_silo_decorators(app_label="sentry", format="json"):
    """Lists which classes have had silo decorators applied."""

    model_table = _create_model_table(app_label)
    endpoint_table = _create_endpoint_table(app_label)

    if format == "json":
        json_repr = {
            "models": ModelPresentation().as_json_repr(model_table),
            "endpoints": EndpointPresentation().as_json_repr(endpoint_table),
        }
        json.dump(json_repr, sys.stdout)
    elif format == "markdown":
        ModelPresentation().print_markdown(model_table)
        EndpointPresentation().print_markdown(endpoint_table)
    else:
        raise ValueError


def _create_model_table(app_label):
    table = defaultdict(list)
    for model_class in django.apps.apps.get_models():
        if model_class._meta.app_label != app_label:
            continue
        limit = getattr(model_class._meta, "silo_limit", None)
        key = (limit.modes, limit.read_only) if limit else None
        table[key].append(model_class)
    return table


def _create_endpoint_table(app_label):
    from sentry.api.base import Endpoint

    def is_endpoint(view_function, bindings):
        view_class = getattr(view_function, "view_class", None)
        return view_class and issubclass(view_class, Endpoint)

    def get_endpoint_classes():
        url_mappings = list(django.urls.get_resolver().reverse_dict.items())
        for (view_function, bindings) in url_mappings:
            if is_endpoint(view_function, bindings):
                yield view_function.view_class

    table = defaultdict(list)
    for endpoint_class in get_endpoint_classes():
        if not endpoint_class.__module__.startswith(app_label):
            continue
        limit = getattr(endpoint_class, "silo_limit", None)
        key = frozenset(limit.modes if limit else ())
        table[key].append(endpoint_class)

    return table


class ConsolePresentation(abc.ABC):
    @property
    @abc.abstractmethod
    def table_label(self):
        raise NotImplementedError

    @abc.abstractmethod
    def order(self, group):
        raise NotImplementedError

    @abc.abstractmethod
    def get_group_label(self, key):
        raise NotImplementedError

    @abc.abstractmethod
    def get_key_repr(self, key):
        raise NotImplementedError

    @staticmethod
    def format_mode_set(modes):
        if modes is None:
            return None
        return sorted(str(x) for x in modes)

    @staticmethod
    def format_value(value):
        return f"{value.__module__}.{value.__name__}"

    def normalize_table(self, table):
        return {
            key: sorted({self.format_value(value) for value in group})
            for (key, group) in (sorted(table.items(), key=self.order))
        }

    def as_json_repr(self, table):
        table = self.normalize_table(table)
        return {
            "total_count": sum(len(group) for group in table.values()),
            "decorators": [
                {
                    "decorator": self.get_key_repr(group_key),
                    "count": len(group),
                    "values": group,
                }
                for group_key, group in table.items()
            ],
        }

    def print_markdown(self, table):
        table = self.normalize_table(table)

        total_count = sum(len(group) for group in table.values())
        table_header = f"{self.table_label} ({total_count})"
        print("\n" + table_header)  # noqa
        print("=" * len(table_header), end="\n\n")  # noqa

        for (group_key, group) in table.items():
            group_label = self.get_group_label(group_key)
            group_header = f"{group_label} ({len(group)})"
            print(group_header)  # noqa
            print("-" * len(group_header), end="\n\n")  # noqa

            for value in group:
                print("  - " + value)  # noqa
            print()  # noqa


class ModelPresentation(ConsolePresentation):
    @property
    def table_label(self):
        return "MODELS"

    def order(self, group):
        group_key, _model_group = group
        if group_key is None:
            return ()
        write_modes, read_modes = group_key
        return (
            len(write_modes),
            len(read_modes),
            self.format_mode_set(write_modes),
            self.format_mode_set(read_modes),
        )

    def get_key_repr(self, key):
        if key is None:
            return None
        write_modes, read_modes = key
        return {
            "write_modes": self.format_mode_set(write_modes),
            "read_modes": self.format_mode_set(read_modes),
        }

    def get_group_label(self, key):
        if key is None:
            return "No decorator"
        write_modes, read_modes = key
        if read_modes:
            return (
                f"{self.format_mode_set(write_modes)}, read_only={self.format_mode_set(read_modes)}"
            )
        else:
            return self.format_mode_set(write_modes)


class EndpointPresentation(ConsolePresentation):
    @property
    def table_label(self):
        return "VIEWS"

    def order(self, group):
        mode_set, _endpoint_group = group
        return len(mode_set or ()), self.format_mode_set(mode_set)

    def get_group_label(self, key):
        return self.format_mode_set(key) if key else "No decorator"

    def get_key_repr(self, key):
        return self.format_mode_set(key)
