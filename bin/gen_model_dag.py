#!/usr/bin/env python
# flake8: noqa
"""Generate a DAG of Django model relationships across the codebase.

Every model with no foreign keys to other models is a "root" (self-referential
FKs don't count), annotated with the database connection it lives on. Every
model gets a ModelNode whose `root_paths` maps each reachable root to the
shortest chain of foreign-key edges leading to it. All six `ForeignFieldKind`
kinds count as edges, including raw `*_id` integer columns
(ImplicitForeignKey) and cross-silo HybridCloudForeignKeys.

Run via:
    .venv/bin/sentry exec bin/gen_model_dag.py [--output model_dag.json]
"""

from __future__ import annotations

import argparse
from enum import StrEnum
import json
import os
from collections import deque
from dataclasses import dataclass, field

from sentry.runner import configure

configure()

from django.conf import settings

from sentry.backup.dependencies import (
    ForeignFieldKind,
    NormalizedModelName,
    dependencies,
    get_model_name,
    sorted_dependencies,
)
from sentry.silo.base import SiloMode
from sentry.db.models.fields.encryption._base import EncryptedField

# `sentry exec` sets __file__ to "<script>", so anchor the default output to
# the invocation directory rather than the script location.
DEFAULT_OUTPUT_PATH = os.path.join(os.getcwd(), "model_dag2.json")


@dataclass
class DatabaseConnection:
    name: str
    host: str
    port: str
    alias: str


@dataclass
class RootModel:
    model_name: str
    table_name: str
    database_connection: DatabaseConnection
    special_fields: list[SpecialFieldAnnotation] = field(default_factory=list)


class FieldType(StrEnum):
    ENCRYPTED_COLUMN = "encrypted_column"


@dataclass
class SpecialFieldAnnotation:
    field_name: str
    field_type: FieldType


@dataclass
class ModelRelationship:
    relationship_type: ForeignFieldKind
    field_name: str
    to_model: str


@dataclass
class ModelNode:
    model_name: str
    table_name: str
    root_paths: dict[str, list[ModelRelationship]] = field(default_factory=dict)
    special_fields: list[SpecialFieldAnnotation] = field(default_factory=list)


class ModelGraph:
    def __init__(self, model_nodes: dict[str, ModelNode], root_models: list[RootModel]) -> None:
        self.model_nodes = model_nodes
        self.root_models = root_models

    def serialize(self) -> dict:
        return {
            "roots": [
                {
                    "model_name": r.model_name,
                    "table_name": r.table_name,
                    "special_fields": [
                        {
                            "field_name": field.field_name,
                            "field_type": field.field_type.value,
                        }
                        for field in r.special_fields
                    ],
                    "database_connection": {
                        "name": r.database_connection.name,
                        "host": r.database_connection.host,
                        "port": r.database_connection.port,
                        "alias": r.database_connection.alias,
                    },
                }
                for r in self.root_models
            ],
            "nodes": {
                name: {
                    "model_name": node.model_name,
                    "table_name": node.table_name,
                    "scary_fields": [
                        {
                            "field_name": field.field_name,
                            "field_type": field.field_type.value,
                        }
                        for field in node.special_fields
                    ],
                    "root_paths": {
                        root: [
                            {
                                "relationship_type": edge.relationship_type.name,
                                "field_name": edge.field_name,
                                "to_model": edge.to_model,
                            }
                            for edge in chain
                        ]
                        for root, chain in sorted(node.root_paths.items())
                    },
                }
                for name, node in self.model_nodes.items()
            },
        }

    def to_json(self) -> dict:
        return json.dumps(self.serialize(), indent=2, sort_keys=True)


class ModelGraphBuilder:
    def __init__(self) -> None:
        self.model_map = {get_model_name(dep): dep for dep in sorted_dependencies()}

    def _build_adjacency(self) -> dict[str, list[ModelRelationship]]:
        """Outgoing FK edges per model, self-references excluded, field-name order."""
        adjacency: dict[str, list[ModelRelationship]] = {}
        for model_name, relations in dependencies().items():
            edges = []
            for field_name in sorted(relations.foreign_keys):
                ff = relations.foreign_keys[field_name]
                target = str(get_model_name(ff.model))
                if target == str(model_name):
                    continue
                edges.append(
                    ModelRelationship(
                        relationship_type=ff.kind, field_name=field_name, to_model=target
                    )
                )
            adjacency[str(model_name)] = edges
        return adjacency

    def _find_special_fields(self, model_name: str) -> list[SpecialFieldAnnotation]:
        model = self.model_map[NormalizedModelName(model_name)]
        if model is None:
            raise ValueError(f"Model {model_name} not found")

        fields = model._meta.get_fields()
        return [
            SpecialFieldAnnotation(field_name=field.name, field_type=FieldType.ENCRYPTED_COLUMN)
            for field in fields
            if isinstance(field, EncryptedField)
        ]

    def _shortest_paths_to_roots(
        self,
        start: str,
        adjacency: dict[str, list[ModelRelationship]],
        roots: set[str],
    ) -> dict[str, list[ModelRelationship]]:
        """BFS from `start`, returning the shortest edge chain to each reachable root.

        Visited-on-enqueue makes cycles in the underlying FK graph safe; the
        recorded shortest paths always form a DAG.
        """
        root_paths: dict[str, list[ModelRelationship]] = {}
        visited: set[str] = {start}
        queue: deque[tuple[str, list[ModelRelationship]]] = deque([(start, [])])
        while queue:
            current, chain = queue.popleft()
            for edge in adjacency.get(current, []):
                if edge.to_model in visited:
                    continue
                visited.add(edge.to_model)
                new_chain = chain + [edge]
                if edge.to_model in roots:
                    root_paths[edge.to_model] = new_chain
                queue.append((edge.to_model, new_chain))
        return root_paths

    def _connection_for_silos(self, silos: list[SiloMode]) -> DatabaseConnection:
        """Resolve the database connection for a model's silo modes.

        Mirrors SiloRouter's simulated mapping: CONTROL-only models live on the
        "control" connection; CELL/MONOLITH models live on "default". Monolith dev
        configs may lack a "control" DATABASES entry, in which case the logical
        alias is kept but the connection details fall back to the default entry.
        """
        alias = "control" if silos == [SiloMode.CONTROL] else "default"
        db = settings.DATABASES.get(alias, settings.DATABASES["default"])
        return DatabaseConnection(
            name=db.get("NAME", ""),
            host=db.get("HOST", ""),
            port=str(db.get("PORT", "")),
            alias=alias,
        )

    def build_graph(self) -> ModelGraph:
        deps = dependencies()
        adjacency = self._build_adjacency()
        roots = {name for name, edges in adjacency.items() if not edges}

        root_models = sorted(
            (
                RootModel(
                    model_name=name,
                    table_name=deps[NormalizedModelName(name)].table_name,
                    database_connection=self._connection_for_silos(
                        deps[NormalizedModelName(name)].silos
                    ),
                    special_fields=self._find_special_fields(name),
                )
                for name in roots
            ),
            key=lambda r: r.model_name,
        )

        nodes = {
            name: ModelNode(
                model_name=name,
                table_name=deps[NormalizedModelName(name)].table_name,
                root_paths=self._shortest_paths_to_roots(name, adjacency, roots),
                special_fields=self._find_special_fields(name),
            )
            for name in sorted(adjacency)
        }

        return ModelGraph(model_nodes=nodes, root_models=root_models)


def print_summary(model_graph: ModelGraphBuilder) -> None:
    roots = {r.model_name for r in model_graph.root_models}
    roots_by_alias: dict[str, int] = {}
    for r in model_graph.root_models:
        alias = r.database_connection.alias
        roots_by_alias[alias] = roots_by_alias.get(alias, 0) + 1

    non_roots = [n for n in model_graph.model_nodes.values() if n.model_name not in roots]
    linked = [n for n in non_roots if n.root_paths]
    unlinked = [n for n in non_roots if not n.root_paths]

    print(f"Total models: {len(model_graph.model_nodes)}")
    print(
        f"Roots: {len(model_graph.root_models)} ({', '.join(f'{a}: {c}' for a, c in sorted(roots_by_alias.items()))})"
    )
    print(f"Non-root models reaching >=1 root: {len(linked)}")
    print(f"Non-root models reaching zero roots (isolated cycles/orphans): {len(unlinked)}")
    for node in unlinked:
        print(f"  - {node.model_name}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default=DEFAULT_OUTPUT_PATH, help="JSON output path")
    # `sentry exec` leaves the script path in sys.argv; ignore unknown args.
    args, _ = parser.parse_known_args()

    model_graph = ModelGraphBuilder().build_graph()
    with open(args.output, "w") as f:
        json.dump(model_graph.serialize(), f, indent=2, sort_keys=True)
    print(f"Wrote {args.output}")
    print_summary(model_graph)


if __name__ == "__main__":
    main()
