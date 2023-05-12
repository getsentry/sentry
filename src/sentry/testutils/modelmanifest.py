from __future__ import annotations

import ast
import logging
import os
from collections import defaultdict
from contextlib import ExitStack, contextmanager
from typing import Any, Dict, Generator, Iterable, MutableMapping, Set, Tuple, Type, Union

import django.apps
from django.apps import apps

from sentry.db.models import BaseManager, Model
from sentry.db.models.manager.base import ModelManagerTriggerAction, ModelManagerTriggerCondition
from sentry.silo.base import SiloMode
from sentry.utils import json

ROOT = os.path.dirname(os.path.abspath(__file__)) + "/../../../"


class ModelManifest:
    """For auditing which models are touched by each test case."""

    file_path: str
    connections: MutableMapping[int, Set[int]]
    model_names: MutableMapping[str, Dict[str, Any]]
    test_names: MutableMapping[str, Dict[str, Any]]
    reverse_lookup: MutableMapping[int, str]
    next_id: int

    def get_or_create_id(self, cache: MutableMapping[str, Dict[str, Any]], name: str) -> int:
        if name in cache:
            return int(cache[name]["id"])
        next_id = self.next_id
        cache[name] = {"id": next_id}
        self.reverse_lookup[next_id] = name
        self.next_id += 1
        return next_id

    class Entry:
        hits: set[Type[Model]]

        def __init__(self) -> None:
            self.hits: Set[Type[Model]] = set()

        def create_trigger_action(
            self, condition: ModelManagerTriggerCondition
        ) -> ModelManagerTriggerAction:
            def action(model_class: Type[Model]) -> None:
                self.hits.add(model_class)

            return action

    def __init__(self, file_path: str) -> None:
        self.file_path = file_path
        self.connections = defaultdict(set)
        self.model_names = {}
        self.test_names = {}
        self.reverse_lookup = {}
        self.next_id = 0
        self.count = 0

    @classmethod
    def from_json_file(cls, file_path: str) -> ModelManifest:
        with open(file_path) as f:
            content = json.load(f)

        manifest = ModelManifest(file_path)
        highest_id = 0
        for model_name, m in content["model_names"].items():
            manifest.model_names[model_name] = m
            highest_id = max(m["id"], highest_id)
            manifest.reverse_lookup[m["id"]] = model_name

        for test_name, d in content["test_names"].items():
            manifest.test_names[test_name] = d
            highest_id = max(d["id"], highest_id)
            manifest.reverse_lookup[d["id"]] = test_name

        for id, connections in content["connections"].items():
            for connection in connections:
                manifest.connections[int(id)].add(int(connection))

        manifest.next_id = highest_id + 1
        return manifest

    def to_json(self) -> Dict[str, Any]:
        return dict(
            connections=self.connections,
            test_names=self.test_names,
            model_names=self.model_names,
        )

    @classmethod
    def open(cls, file_path: str) -> ModelManifest:
        if os.path.exists(file_path):
            return cls.from_json_file(file_path)
        return cls(file_path)

    @contextmanager
    def write(self) -> Generator[None, None, None]:
        try:
            yield  # allow population via register
        finally:
            with open(self.file_path, mode="w") as f:
                json.dump(self.to_json(), f)

    @staticmethod
    def _get_all_model_managers() -> Iterable[BaseManager]:
        for model_class in django.apps.apps.get_models():
            manager = model_class.objects
            if isinstance(manager, BaseManager):
                yield manager

    @contextmanager
    def register(self, test_name: str) -> Generator[None, None, None]:
        with ExitStack() as stack:
            entries = []

            for model_manager in self._get_all_model_managers():
                entries.append(entry := ModelManifest.Entry())
                for condition in ModelManagerTriggerCondition:
                    action = entry.create_trigger_action(condition)
                    stack.enter_context(model_manager.register_trigger(condition, action))

            # Overwrite the entire test in place, in case it used to touch a
            # model and doesn't anymore
            test_id = self.get_or_create_id(self.test_names, test_name)
            hc_test = self.hybrid_cloud_test(test_name)
            self.test_names[test_name] = {
                "id": test_id,
                "stable": hc_test.decorator_was_stable or False,
                "annotated": hc_test.decorator_match_line is not None,
            }

            try:
                yield
            finally:
                self.connections[test_id] = set()
                for key in list(self.connections.keys()):
                    if test_id in self.connections[key]:
                        self.connections[key].remove(test_id)

                for entry in entries:
                    for model in entry.hits:
                        model_id = self.get_or_create_id(self.model_names, model.__name__)
                        self.connections[test_id].add(model_id)
                        self.connections[model_id].add(test_id)

                self.count += 1
                if self.count % 100 == 0:
                    with open(self.file_path, mode="w") as f:
                        json.dump(self.to_json(), f)

    def hybrid_cloud_test(self, test_name: str) -> HybridCloudTestVisitor:
        # test_id = self.test_names[test_name]["id"]
        test_file_path: str
        test_case_name: str
        test_name = test_name.split("[")[0]
        test_file_path, test_case_name = test_name.split("::")
        test_file_path = ROOT + test_file_path

        test_visitor = HybridCloudTestVisitor(test_file_path, test_case_name)
        test_visitor.load()
        return test_visitor

    def determine_silo_based_on_connections(self, test_name: str) -> SiloMode:
        logger = logging.getLogger()
        test_id = self.get_or_create_id(self.test_names, test_name)
        region_votes = 0
        control_votes = 0
        for model_id in self.connections[test_id]:
            model_name = self.reverse_lookup[model_id]
            try:
                model = apps.get_model("sentry", model_name)
            except Exception:
                continue

            if not model:
                logger.warning(f"Model {model_name} not found in db 'sentry'")
                continue

            if SiloMode.CONTROL in model._meta.silo_limit.modes:
                control_votes += 1
            elif SiloMode.REGION in model._meta.silo_limit.modes:
                region_votes += 1

        logger.info(f"   Control: {control_votes}, Region: {region_votes}")
        if control_votes > region_votes:
            return SiloMode.CONTROL
        return SiloMode.REGION


class HybridCloudTestDecoratorVisitor(ast.NodeVisitor):
    match_line: Tuple[int, int] | None

    def __init__(self) -> None:
        self.match_line = None
        self.stable = False

    def visit_keyword(self, node: ast.keyword) -> Any:
        if node.arg == "stable":
            if isinstance(node.value, ast.Constant):
                self.stable = node.value.value

    def visit_Name(self, node: ast.Name) -> Any:
        if node.id.endswith("_silo_test"):
            self.match_line = (node.lineno, node.col_offset - 1)
        return ast.NodeVisitor.generic_visit(self, node)

    def visit_Attribute(self, node: ast.Attribute) -> Any:
        pass


class HybridCloudTestVisitor(ast.NodeVisitor):
    import_match_line: Tuple[int, int] | None
    class_node: ast.ClassDef | None
    func_match_line: Tuple[int, int] | None
    decorator_match_line: Tuple[int, int] | None

    def __init__(self, test_file_path: str, test_name: str):
        self.test_file_path = test_file_path
        self.test_name = test_name
        self.target_symbol_parts = test_name.split(".")
        self.import_match_line = None
        self.decorator_match_line = None
        self.func_match_line = None
        self.class_node = None
        self.decorator_was_stable = False

    @property
    def exists(self) -> bool:
        return os.path.exists(self.test_file_path)

    def load(self) -> None:
        with open(self.test_file_path) as f:
            file_ast = ast.parse(f.read())
            self.visit(file_ast)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> Any:
        if node.module == "sentry.testutils.silo":
            for name in node.names:
                if isinstance(name, ast.alias):
                    if name.name.endswith("_silo_test"):
                        self.import_match_line = (node.lineno, node.col_offset)

    def visit_ClassDef(self, node: ast.ClassDef) -> Any:
        if len(self.target_symbol_parts) == 2 and self.target_symbol_parts[0] == node.name:
            self.class_node = node
            self.generic_visit(node)
            self.class_node = None
        elif len(self.target_symbol_parts) == 1:
            if self.target_symbol_parts[-1] == node.name or self.target_symbol_parts[-1] in {
                e.id for e in node.bases if isinstance(e, ast.Name)
            }:
                self.mark_target(node)

    def visit_FunctionDef(self, node: Union[ast.FunctionDef, ast.ClassDef]) -> Any:
        if self.target_symbol_parts[-1] == node.name:
            if self.class_node:
                node = self.class_node
            elif len(self.target_symbol_parts) != 1:
                return

            self.mark_target(node)
            return

        return self.generic_visit(node)

    def mark_target(self, node: Union[ast.FunctionDef, ast.ClassDef]) -> None:
        self.func_match_line = (node.lineno, node.col_offset)
        for expr in node.decorator_list:
            decorator_visitor = HybridCloudTestDecoratorVisitor()
            decorator_visitor.visit(expr)
            if decorator_visitor.match_line:
                self.decorator_match_line = decorator_visitor.match_line
                self.decorator_was_stable = decorator_visitor.stable
                break
