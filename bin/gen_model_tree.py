#!/usr/bin/env python
# flake8: noqa
"""Generate dependent trees of Django model relationships across the codebase.

Every model with no foreign keys to other models is a "root" (self-referential
FKs don't count). One tree is built per root: children of a node are the models
that foreign-key *to* it (reversed edges), placed once per tree at their
shallowest depth via BFS. A model reachable from several roots appears in each
of those roots' trees.

Every tree node embeds the full ModelNode payload (model_name, table_name,
primary_key, database_connection, root_paths, special_fields,
number_of_dependents) plus tree
annotations: the database connection of the tree's root, the number of nodes
in its subtree, and the number of external (non-postgres) connections in its
subtree. All six `ForeignFieldKind` kinds count as edges, including raw `*_id`
integer columns (ImplicitForeignKey) and cross-silo HybridCloudForeignKeys.

Run via:
    .venv/bin/sentry exec bin/gen_model_tree.py [--output model_tree.json]
    .venv/bin/sentry exec bin/gen_model_tree.py --mermaid sentry.fileblob
    .venv/bin/sentry exec bin/gen_model_tree.py --bfs sentry.fileblob
"""

from __future__ import annotations

import argparse
from enum import StrEnum
import json
import os
import re
from collections import Counter, deque
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
from sentry.db.models.fields.externaldatamapping import (
    ExternalDataMappingField,
    ExternalMappingType,
)

# `sentry exec` sets __file__ to "<script>", so anchor the default output to
# the invocation directory rather than the script location.
DEFAULT_OUTPUT_PATH = os.path.join(os.getcwd(), "model_tree.json")


@dataclass
class DatabaseConnection:
    name: str
    host: str
    port: str
    alias: str


class FieldType(StrEnum):
    ENCRYPTED_COLUMN = "encrypted_column"
    # Raw integer column holding the id of a row in another (or the same)
    # postgres database, invisible to Django's relation graph. Sourced from
    # ExternalDataMappingField annotations with mapping_type=POSTGRES.
    CROSS_DATABASE_REFERENCE = "cross_database_reference"


@dataclass
class SpecialFieldAnnotation:
    field_name: str
    field_type: FieldType
    description: str | None = None


@dataclass
class ExternalSystemReference:
    """A column referencing a non-postgres system (filestore, objectstore, ...)."""

    model_name: str
    table_name: str
    field_name: str
    description: str


@dataclass
class ModelRelationship:
    relationship_type: ForeignFieldKind
    field_name: str
    to_model: str


@dataclass
class ModelNode:
    model_name: str
    table_name: str
    primary_key: str
    database_connection: DatabaseConnection
    root_paths: dict[str, list[ModelRelationship]] = field(default_factory=dict)
    special_fields: list[SpecialFieldAnnotation] = field(default_factory=list)
    number_of_dependents: int = 0


@dataclass
class TreeNode:
    """A model's placement in one root's dependent tree.

    `node` is shared by reference across every tree the model appears in; the
    tree annotations (root database, subtree counts, children) are placement-
    specific. `parent_edge` is the foreign key on this model pointing at its
    tree parent; None on roots.
    """

    node: ModelNode
    root_database: DatabaseConnection
    parent_edge: ModelRelationship | None = None
    subtree_node_count: int = 0
    subtree_external_connections: int = 0
    children: list[TreeNode] = field(default_factory=list)


def _serialize_database_connection(connection: DatabaseConnection) -> dict:
    return {
        "name": connection.name,
        "host": connection.host,
        "port": connection.port,
        "alias": connection.alias,
    }


def serialize_tree_node(tree_node: TreeNode) -> dict:
    """Serialize one tree node's payload (everything except `children`)."""
    node = tree_node.node
    return {
        "model_name": node.model_name,
        "table_name": node.table_name,
        "primary_key": node.primary_key,
        "number_of_dependents": node.number_of_dependents,
        "database_connection": _serialize_database_connection(node.database_connection),
        "special_fields": [
            {
                "field_name": sf.field_name,
                "field_type": sf.field_type.value,
                "description": sf.description,
            }
            for sf in node.special_fields
        ],
        "root_paths": {
            root_name: [
                {
                    "relationship_type": edge.relationship_type.name,
                    "field_name": edge.field_name,
                    "to_model": edge.to_model,
                }
                for edge in chain
            ]
            for root_name, chain in sorted(node.root_paths.items())
        },
        "root_database": _serialize_database_connection(tree_node.root_database),
        "parent_edge": (
            {
                "relationship_type": tree_node.parent_edge.relationship_type.name,
                "field_name": tree_node.parent_edge.field_name,
                "to_model": tree_node.parent_edge.to_model,
            }
            if tree_node.parent_edge is not None
            else None
        ),
        "subtree_node_count": tree_node.subtree_node_count,
        "subtree_external_connections": tree_node.subtree_external_connections,
    }


def serialize_external_references(
    externally_referenced_systems: dict[str, list[ExternalSystemReference]],
) -> dict:
    return {
        system: [
            {
                "model_name": ref.model_name,
                "table_name": ref.table_name,
                "field_name": ref.field_name,
                "description": ref.description,
            }
            for ref in refs
        ]
        for system, refs in externally_referenced_systems.items()
    }


class ModelForest:
    def __init__(
        self,
        trees: list[TreeNode],
        unreachable_models: list[str],
        externally_referenced_systems: dict[str, list[ExternalSystemReference]],
    ) -> None:
        self.trees = trees
        self.unreachable_models = unreachable_models
        self.externally_referenced_systems = externally_referenced_systems

    def _serialize_tree(self, root: TreeNode) -> dict:
        """Iteratively serialize a tree (they can be deep; avoid recursion)."""
        serialized: dict[int, dict] = {}
        # Children before parents: process in reverse BFS order.
        order: list[TreeNode] = []
        queue: deque[TreeNode] = deque([root])
        while queue:
            tree_node = queue.popleft()
            order.append(tree_node)
            queue.extend(tree_node.children)
        for tree_node in reversed(order):
            serialized[id(tree_node)] = serialize_tree_node(tree_node) | {
                "children": [serialized[id(child)] for child in tree_node.children],
            }
        return serialized[id(root)]

    def serialize(self) -> dict:
        return {
            "externally-referenced-systems": serialize_external_references(
                self.externally_referenced_systems
            ),
            "trees": [self._serialize_tree(tree) for tree in self.trees],
            "unreachable_models": self.unreachable_models,
        }

    def to_json(self) -> str:
        return json.dumps(self.serialize(), indent=2, sort_keys=True)


class MermaidTreeRenderer:
    """Render one root's dependent tree as Mermaid flowchart text.

    Arrows point from dependent to dependency (the direction of the foreign
    key), labeled with the referencing field; `flowchart BT` therefore lays the
    root out at the top. Line types distinguish where an edge lands:

        A -->|field| B      solid: foreign key within the same database
        A -.->|field| B     dashed: cross-database relationship (a FK whose
                            endpoints live on different connections, or a raw
                            CROSS_DATABASE_REFERENCE column into another
                            postgres database)
        A ==>|field| B      thick: reference into an external non-postgres
                            system (filestore, objectstore, ...)

    External systems appear as cylinder-shaped leaf nodes with the `external`
    class; model nodes are labeled with their own database alias.
    """

    def __init__(
        self,
        tree: TreeNode,
        externally_referenced_systems: dict[str, list[ExternalSystemReference]],
    ) -> None:
        self.tree = tree
        self.external_refs: dict[str, list[tuple[str, ExternalSystemReference]]] = {}
        for system, refs in externally_referenced_systems.items():
            for ref in refs:
                self.external_refs.setdefault(ref.model_name, []).append((system, ref))

    @staticmethod
    def _node_id(name: str) -> str:
        return re.sub(r"[^0-9a-zA-Z_]", "_", name)

    def render(self) -> str:
        model_lines: list[str] = []
        external_lines: list[str] = []
        edge_lines: list[str] = []
        seen_externals: set[str] = set()

        def external_node(system: str, label: str) -> str:
            ext_id = f"external_{self._node_id(system)}"
            if system not in seen_externals:
                seen_externals.add(system)
                external_lines.append(f'    {ext_id}[("{label}")]:::external')
            return ext_id

        queue: deque[TreeNode] = deque([self.tree])
        while queue:
            tree_node = queue.popleft()
            node = tree_node.node
            node_id = self._node_id(node.model_name)
            model_lines.append(
                f'    {node_id}["{node.model_name}<br/>db: {node.database_connection.alias}"]'
            )
            for sf in node.special_fields:
                if sf.field_type == FieldType.CROSS_DATABASE_REFERENCE:
                    ext_id = external_node("postgres", "postgres (other database)")
                    edge_lines.append(f"    {node_id} -.->|{sf.field_name}| {ext_id}")
            for system, ref in self.external_refs.get(node.model_name, []):
                ext_id = external_node(system, system)
                edge_lines.append(f"    {node_id} ==>|{ref.field_name}| {ext_id}")
            for child in tree_node.children:
                assert child.parent_edge is not None
                cross_db = child.node.database_connection.alias != node.database_connection.alias
                arrow = "-.->" if cross_db else "-->"
                edge_lines.append(
                    f"    {self._node_id(child.node.model_name)} "
                    f"{arrow}|{child.parent_edge.field_name}| {node_id}"
                )
                queue.append(child)

        lines = [
            "flowchart BT",
            "    classDef external fill:#f4f4f4,stroke:#999,stroke-dasharray: 3 3",
        ]
        return "\n".join(lines + model_lines + external_lines + edge_lines)


class BfsTreePrinter:
    """Dump a root's dependent tree as JSON, nodes flattened in BFS order.

    Each entry in `nodes` carries the same payload as the nested tree
    serialization (the DAG-style ModelNode fields plus this script's tree
    annotations) with a `depth` field instead of nested `children`; the array
    order is the BFS (level-order) traversal, with each depth sorted by the
    number of roots the model references (len of `root_paths`), ascending.
    External (non-postgres) dependencies of the tree's models get their own
    `externally-referenced-systems` property.
    """

    def __init__(
        self,
        tree: TreeNode,
        externally_referenced_systems: dict[str, list[ExternalSystemReference]],
    ) -> None:
        self.tree = tree
        self.externally_referenced_systems = externally_referenced_systems

    def serialize(self) -> dict:
        nodes = []
        members: set[str] = set()
        depth = 0
        level: list[TreeNode] = [self.tree]
        while level:
            # Stable sort: ties keep the deterministic child-name order.
            level.sort(key=lambda tree_node: len(tree_node.node.root_paths))
            next_level: list[TreeNode] = []
            for tree_node in level:
                members.add(tree_node.node.model_name)
                nodes.append(serialize_tree_node(tree_node) | {"depth": depth})
                next_level.extend(tree_node.children)
            level = next_level
            depth += 1

        tree_externals = {
            system: tree_refs
            for system, refs in self.externally_referenced_systems.items()
            if (tree_refs := [ref for ref in refs if ref.model_name in members])
        }
        return {
            "root_model": self.tree.node.model_name,
            "nodes": nodes,
            "externally-referenced-systems": serialize_external_references(tree_externals),
        }

    def render(self) -> str:
        return json.dumps(self.serialize(), indent=2, sort_keys=True)

    def print(self) -> None:
        print(self.render())


class ModelTreeBuilder:
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

        annotations = []
        for field in model._meta.get_fields():
            if isinstance(field, EncryptedField):
                annotations.append(
                    SpecialFieldAnnotation(
                        field_name=field.name, field_type=FieldType.ENCRYPTED_COLUMN
                    )
                )
            elif (
                isinstance(field, ExternalDataMappingField)
                and field.mapping_type == ExternalMappingType.POSTGRES
            ):
                annotations.append(
                    SpecialFieldAnnotation(
                        field_name=field.name,
                        field_type=FieldType.CROSS_DATABASE_REFERENCE,
                        description=field.mapping_description,
                    )
                )
        return annotations

    def _find_external_system_references(self) -> dict[str, list[ExternalSystemReference]]:
        """Columns pointing at non-postgres systems, grouped by system name.

        Postgres mappings are deliberately excluded here: they stay node-local
        as CROSS_DATABASE_REFERENCE special fields, while everything else
        (filestore, objectstore, ...) is an edge out of postgres entirely.
        """
        references: dict[str, list[ExternalSystemReference]] = {}
        for model_name, relations in dependencies().items():
            for field in relations.model._meta.get_fields():
                if (
                    isinstance(field, ExternalDataMappingField)
                    and field.mapping_type != ExternalMappingType.POSTGRES
                ):
                    references.setdefault(field.mapping_type.value, []).append(
                        ExternalSystemReference(
                            model_name=str(model_name),
                            table_name=relations.table_name,
                            field_name=field.name,
                            description=field.mapping_description,
                        )
                    )
        for refs in references.values():
            refs.sort(key=lambda ref: (ref.model_name, ref.field_name))
        return references

    def _count_external_connections(self) -> dict[str, int]:
        """Non-postgres ExternalDataMappingFields per model."""
        counts: dict[str, int] = {}
        for refs in self._find_external_system_references().values():
            for ref in refs:
                counts[ref.model_name] = counts.get(ref.model_name, 0) + 1
        return counts

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

    def _find_primary_key(self, model_name: str) -> str:
        model = self.model_map[NormalizedModelName(model_name)]
        if model is None:
            raise ValueError(f"Model {model_name} not found")
        return model._meta.get_field(model._meta.pk.name).name

    def _build_tree(
        self,
        root_name: str,
        reverse_adjacency: dict[str, list[tuple[str, ModelRelationship]]],
        model_nodes: dict[str, ModelNode],
        root_database: DatabaseConnection,
        external_counts: dict[str, int],
    ) -> TreeNode:
        """BFS spanning tree over reversed FK edges, then post-order counts.

        Visited-on-enqueue places each model once, at its shallowest depth;
        cycles and diamond shapes in the reversed graph are therefore safe.
        """
        root = TreeNode(node=model_nodes[root_name], root_database=root_database)
        visited: set[str] = {root_name}
        order: list[TreeNode] = [root]
        queue: deque[tuple[str, TreeNode]] = deque([(root_name, root)])
        while queue:
            current, tree_node = queue.popleft()
            for child_name, edge in sorted(
                reverse_adjacency.get(current, []), key=lambda pair: (pair[0], pair[1].field_name)
            ):
                if child_name in visited:
                    continue
                visited.add(child_name)
                child = TreeNode(
                    node=model_nodes[child_name],
                    root_database=root_database,
                    parent_edge=edge,
                )
                tree_node.children.append(child)
                order.append(child)
                queue.append((child_name, child))

        # Reverse BFS order visits every child before its parent.
        for tree_node in reversed(order):
            tree_node.subtree_node_count = 1 + sum(
                child.subtree_node_count for child in tree_node.children
            )
            tree_node.subtree_external_connections = external_counts.get(
                tree_node.node.model_name, 0
            ) + sum(child.subtree_external_connections for child in tree_node.children)
        return root

    def build_forest(self) -> ModelForest:
        deps = dependencies()
        adjacency = self._build_adjacency()
        roots = {name for name, edges in adjacency.items() if not edges}

        dependent_counts: Counter[str] = Counter()
        for edges in adjacency.values():
            for edge in edges:
                dependent_counts[edge.to_model] += 1

        # One ModelNode per model, shared by reference across every tree it
        # appears in.
        model_nodes = {
            name: ModelNode(
                model_name=name,
                table_name=deps[NormalizedModelName(name)].table_name,
                primary_key=self._find_primary_key(name),
                database_connection=self._connection_for_silos(
                    deps[NormalizedModelName(name)].silos
                ),
                root_paths=self._shortest_paths_to_roots(name, adjacency, roots),
                special_fields=self._find_special_fields(name),
                number_of_dependents=dependent_counts.get(name, 0),
            )
            for name in sorted(adjacency)
        }

        reverse_adjacency: dict[str, list[tuple[str, ModelRelationship]]] = {}
        for name, edges in adjacency.items():
            for edge in edges:
                reverse_adjacency.setdefault(edge.to_model, []).append((name, edge))

        external_counts = self._count_external_connections()

        trees = [
            self._build_tree(
                root_name=name,
                reverse_adjacency=reverse_adjacency,
                model_nodes=model_nodes,
                root_database=model_nodes[name].database_connection,
                external_counts=external_counts,
            )
            for name in sorted(roots)
        ]

        unreachable = sorted(
            name for name, node in model_nodes.items() if name not in roots and not node.root_paths
        )

        return ModelForest(
            trees=trees,
            unreachable_models=unreachable,
            externally_referenced_systems=self._find_external_system_references(),
        )


def print_summary(forest: ModelForest) -> None:
    trees_by_alias: dict[str, int] = {}
    placed_models: set[str] = set()
    total_placements = 0
    for tree in forest.trees:
        alias = tree.root_database.alias
        trees_by_alias[alias] = trees_by_alias.get(alias, 0) + 1
        total_placements += tree.subtree_node_count
        stack = [tree]
        while stack:
            tree_node = stack.pop()
            placed_models.add(tree_node.node.model_name)
            stack.extend(tree_node.children)

    largest = sorted(forest.trees, key=lambda t: -t.subtree_node_count)[:5]

    print(
        f"Trees: {len(forest.trees)} ({', '.join(f'{a}: {c}' for a, c in sorted(trees_by_alias.items()))})"
    )
    print(f"Distinct models placed in >=1 tree: {len(placed_models)}")
    print(f"Total node placements across trees: {total_placements}")
    print("Largest trees:")
    for tree in largest:
        print(
            f"  - {tree.node.model_name}: {tree.subtree_node_count} nodes, "
            f"{tree.subtree_external_connections} external connections"
        )
    print(f"Models reaching zero roots (isolated cycles/orphans): {len(forest.unreachable_models)}")
    for name in forest.unreachable_models:
        print(f"  - {name}")


def find_tree(forest: ModelForest, root_model: str) -> TreeNode:
    tree = next((t for t in forest.trees if t.node.model_name == root_model), None)
    if tree is None:
        roots = ", ".join(t.node.model_name for t in forest.trees)
        raise SystemExit(f"unknown root model {root_model!r}; known roots: {roots}")
    return tree


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default=DEFAULT_OUTPUT_PATH, help="JSON output path")
    parser.add_argument(
        "--mermaid",
        default=None,
        metavar="ROOT_MODEL",
        help="print a Mermaid flowchart of the given root's dependent tree instead of writing JSON",
    )
    parser.add_argument(
        "--bfs",
        default=None,
        metavar="ROOT_MODEL",
        help=(
            "print the given root's dependent tree as JSON with nodes flattened "
            "in BFS order, instead of writing the full JSON file"
        ),
    )
    # `sentry exec` leaves the script path in sys.argv; ignore unknown args.
    args, _ = parser.parse_known_args()

    forest = ModelTreeBuilder().build_forest()

    if args.mermaid:
        tree = find_tree(forest, args.mermaid)
        print(MermaidTreeRenderer(tree, forest.externally_referenced_systems).render())
        return

    if args.bfs:
        BfsTreePrinter(find_tree(forest, args.bfs), forest.externally_referenced_systems).print()
        return

    with open(args.output, "w") as f:
        json.dump(forest.serialize(), f, indent=2, sort_keys=True)
    print(f"Wrote {args.output}")
    print_summary(forest)


if __name__ == "__main__":
    main()
