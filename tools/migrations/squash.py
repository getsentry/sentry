import ast
import contextlib
import json
import os.path
import subprocess
import tempfile
import textwrap
from collections.abc import Generator, Mapping
from typing import Any, NamedTuple

# for squash
_SAFE_RUN_SQL_IMPORT = "from sentry.new_migrations.monkey.special import SafeRunSQL\n"
_GIST_EXT = """\
        # would be nice but it doesn't support hints :(
        # django.contrib.postgres.operations.BtreeGistExtension(),
        SafeRunSQL(
            sql="CREATE EXTENSION IF NOT EXISTS btree_gist;",
            reverse_sql="",
            hints={{"tables": [{table!r}]}},
        ),
"""
_EXCLUSION_TABLES = {
    "groupopenperiod": "sentry_groupopenperiod",
    "spendallocation": "accounts_spend_allocations",
}


def _get_kw(kws: list[ast.keyword], name: str) -> ast.keyword | None:
    for kw in kws:
        if kw.arg == name:
            return kw
    else:
        return None


def _is_assign_to(node: ast.Assign, name: str) -> bool:
    return (
        len(node.targets) == 1
        and isinstance(node.targets[0], ast.Name)
        and node.targets[0].id == name
    )


def _get_repo() -> str:
    repo = os.path.basename(os.getcwd())
    assert repo in {"sentry", "getsentry"}, repo
    return repo


class App(NamedTuple):
    name: str
    current: str
    root: str
    replaces: list[str]

    @property
    def is_already_squashed(self) -> bool:
        return self.current[4:14] == "_squashed_"

    @property
    def squash_name(self) -> str:
        if self.is_already_squashed:
            return self.current
        else:
            return f"0001_squashed_{self.current}"

    @property
    def squash_fname(self) -> str:
        return os.path.join(self.root, f"{self.squash_name}.py")


def _migration_root(app: str) -> str:
    if app == "getsentry":
        return "getsentry/migrations"
    elif app == "sentry":
        return "src/sentry/migrations"
    elif app == "social_auth":
        return "src/social_auth/migrations"
    elif app == "nodestore":
        return "src/sentry/services/nodestore/migrations"
    else:
        return f"src/sentry/{app}/migrations"


def _migrations(root: str) -> Generator[str]:
    for fname in os.listdir(root):
        if fname[0].isdigit() and fname.endswith(".py"):
            yield fname


def _get_replaces(root: str) -> list[str]:
    ret = []
    for fname in _migrations(root):
        ret.append(fname.removesuffix(".py"))
    ret.sort()
    return ret


def _parse_lockfile() -> list[App]:
    apps = []
    with open("migrations_lockfile.txt") as f:
        for line in f:
            if ": " in line:
                app, current = line.strip().split(": ", 1)
                root = _migration_root(app)
                apps.append(
                    App(
                        name=app,
                        current=current,
                        root=root,
                        replaces=_get_replaces(root),
                    )
                )
    return apps


def _dependencies(app: App, tree: ast.AST) -> Generator[tuple[ast.Tuple, str]]:
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Assign)
            and _is_assign_to(node, "dependencies")
            and isinstance(node.value, ast.List)
        ):
            for elt in node.value.elts:
                if isinstance(elt, ast.Tuple):
                    cand, _ = ast.literal_eval(elt)
                    if cand != app.name:
                        yield elt, cand


def _target_line(target: str, all_apps: dict[str, App]) -> str:
    return f'        ("{target}", "{all_apps[target].squash_name}"),'


@contextlib.contextmanager
def _cleared_deps(already_squashed: list[App], squash: dict[str, App]) -> Generator[None]:
    all_apps = {app.name: app for app in already_squashed} | squash
    all_fixups = []
    for app in already_squashed:
        with open(app.squash_fname, encoding="UTF-8") as f:
            lines = f.readlines()

        tree = ast.parse("".join(lines), filename=app.squash_fname)
        fixups = {elt.lineno: target for elt, target in _dependencies(app, tree)}

        if fixups:
            all_fixups.append((app.squash_fname, fixups))

            with open(app.squash_fname, "w", encoding="UTF-8") as f:
                f.writelines(
                    (f"# {line}" if i in fixups else line for i, line in enumerate(lines, start=1))
                )

    try:
        yield
    finally:
        for fname, fixups in all_fixups:
            with open(fname, encoding="UTF-8") as f:
                lines = f.readlines()

            with open(fname, "w", encoding="UTF-8") as f:
                f.writelines(
                    (
                        _target_line(fixups[i], all_apps) if i in fixups else line
                        for i, line in enumerate(lines, start=1)
                    )
                )


def _list_assign(tree: ast.AST, name: str) -> tuple[ast.Assign, ast.List]:
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Assign)
            and _is_assign_to(node, name)
            and isinstance(node.value, ast.List)
        ):
            return node, node.value
    raise AssertionError(f"no {name} list found")


def _expanded_list(source: str, assign: ast.Assign, value: ast.List, block: str) -> str:
    indent = " " * assign.col_offset
    body = "".join(f"{indent}    {ast.get_source_segment(source, elt)},\n" for elt in value.elts)
    return f"{indent}{ast.unparse(assign.targets[0])} = [\n{body}{block}{indent}]\n"


def _import_identities(tree: ast.AST) -> set[str]:
    # `import a.b` is keyed by its dotted path (repeats are legal), while a bare
    # `from m import n` binding is keyed by the name it binds (repeats are F811).
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names.update(alias.asname or alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            names.update(alias.asname or alias.name for alias in node.names)
    return names


def inject_pending_deletions(lines: list[str], payload: Mapping[str, Any]) -> list[str]:
    if not payload.get("operations") and not payload.get("dependencies"):
        return lines

    # earlier _fixup rewrites replace one element with a multi-line string, so the
    # caller's list indices no longer match physical line numbers ast reports.
    source = "".join(lines)
    lines = source.splitlines(keepends=True)
    tree = ast.parse(source)

    ops_assign, ops_value = _list_assign(tree, "operations")
    deps_assign, deps_value = _list_assign(tree, "dependencies")

    op_block = ""
    for op_text in payload.get("operations", []):
        op_block += "".join(f"        {ln}\n" for ln in textwrap.dedent(op_text).splitlines())

    dep_block = "".join(
        f'        ("{app}", "{name}"),\n' for app, name in payload.get("dependencies", [])
    )

    bound = _import_identities(tree)
    import_block = "".join(
        f"{imp}\n"
        for imp in payload.get("imports", [])
        if not _import_identities(ast.parse(imp)) <= bound
    )

    # a single-line list has no closing-bracket line of its own to insert before, so
    # rewrite the whole assignment into expanded form with the block already inside.
    rewrites: dict[int, str] = {}
    inserts: dict[int, str] = {}
    for assign, value, block in (
        (deps_assign, deps_value, dep_block),
        (ops_assign, ops_value, op_block),
    ):
        if not block:
            continue
        assert value.end_lineno is not None
        if value.lineno == value.end_lineno:
            rewrites[assign.lineno] = _expanded_list(source, assign, value, block)
            for skip in range(assign.lineno + 1, value.end_lineno + 1):
                rewrites.setdefault(skip, "")
        else:
            inserts[value.end_lineno] = block

    out: list[str] = []
    for i, line in enumerate(lines, start=1):
        if i in inserts:
            out.append(inserts[i])
        out.append(rewrites[i] if i in rewrites else line)

    if import_block:
        last_import = 0
        for j, line in enumerate(out):
            if line.startswith(("import ", "from ")):
                last_import = j
        out.insert(last_import + 1, import_block)

    return out


def _delete_migrations(app: App) -> None:
    for fname in _migrations(app.root):
        os.remove(os.path.join(app.root, fname))


class FixupVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.initial_lineno: int | None = None
        self.is_post_deployment_lineno: int | None = None
        self.first_exclude_constraint: tuple[str, int] | None = None

    def visit_Assign(self, node: ast.Assign) -> None:
        if _is_assign_to(node, "initial"):
            self.initial_lineno = node.lineno
        elif _is_assign_to(node, "is_post_deployment"):
            self.is_post_deployment_lineno = node.lineno

        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        if (
            self.first_exclude_constraint is None
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "AddConstraint"
        ):
            kw = _get_kw(node.keywords, "constraint")
            if (
                kw is not None
                and isinstance(kw.value, ast.Call)
                and isinstance(kw.value.func, ast.Attribute)
                and kw.value.func.attr == "ExclusionConstraint"
            ):
                model_name_kw = _get_kw(node.keywords, "model_name")
                assert (
                    model_name_kw is not None
                    and isinstance(model_name_kw.value, ast.Constant)
                    and isinstance(model_name_kw.value.value, str)
                )
                table = _EXCLUSION_TABLES[model_name_kw.value.value]
                self.first_exclude_constraint = (table, node.lineno)

        self.generic_visit(node)


def _fixup(app: App, squash: dict[str, App], injections: dict[str, Any]) -> None:
    squashed = os.path.join(app.root, "0001_squash.py")
    if not os.path.exists(squashed):
        return  # all models were deleted in the app

    os.rename(squashed, app.squash_fname)

    with open(app.squash_fname, encoding="UTF-8") as f:
        lines = list(f)

    tree = ast.parse("".join(lines), filename=app.squash_fname)

    for elt, target in _dependencies(app, tree):
        if target in squash:
            lines[elt.lineno - 1] = _target_line(target, squash)

    visitor = FixupVisitor()
    visitor.visit(tree)

    if visitor.first_exclude_constraint is not None:
        gist_table, gist_line = visitor.first_exclude_constraint
        lines.insert(gist_line - 1, _GIST_EXT.format(table=gist_table))

    replaces = [(app.name, replace) for replace in app.replaces]

    assert visitor.is_post_deployment_lineno is not None
    post_deploy_and_replaces = f"""\
    is_post_deployment = True

    replaces = {repr(replaces)[:-1]},]
"""
    lines[visitor.is_post_deployment_lineno - 1] = post_deploy_and_replaces

    if visitor.initial_lineno is not None:
        initial_and_checked = """\
    initial = True

    checked = False  # This is an initial migration and can take locks
"""
        lines[visitor.initial_lineno - 1] = initial_and_checked

    if visitor.first_exclude_constraint is not None:
        lines.insert(2, _SAFE_RUN_SQL_IMPORT)

    payload = injections.get(app.name)
    if payload is not None:
        lines = inject_pending_deletions(lines, payload)

    with open(app.squash_fname, "w", encoding="UTF-8") as f:
        f.writelines(lines)


def _write_lockfile(apps: list[App]) -> None:
    with open("migrations_lockfile.txt", encoding="UTF-8") as f:
        lines = f.readlines()

    with open("migrations_lockfile.txt", "w", encoding="UTF-8") as f:
        f.writelines(lines[:6])
        for app in apps:
            if os.path.exists(app.squash_fname):
                f.write(f"\n{app.name}: {app.squash_name}\n")


def main() -> int:
    repo = _get_repo()
    apps = _parse_lockfile()

    already_squashed = [app for app in apps if app.is_already_squashed]
    squash = {app.name: app for app in apps if not app.is_already_squashed}

    with tempfile.NamedTemporaryFile("r", suffix=".json", delete=False) as tmp:
        bake_out = tmp.name
    subprocess.check_call(
        (repo, "django", "bake_pending_deletions", "--out", bake_out),
        stdout=subprocess.DEVNULL,
    )
    with open(bake_out) as f:
        baked = json.load(f)
    os.remove(bake_out)

    injections = baked["injections"]
    if baked["empty_apps"]:
        apps_list = ", ".join(baked["empty_apps"])
        raise SystemExit(
            f"cannot squash: {apps_list} would be left with only pending-deletion models, "
            "which makemigrations cannot regenerate. Land the step-2 DeletionAction.DELETE "
            "migration for these before squashing."
        )

    with _cleared_deps(already_squashed, squash):
        for app in squash.values():
            _delete_migrations(app)

        print(f"squashing {', '.join(sorted(squash))}...")
        cmd = (repo, "django", "makemigrations", "-n", "squash")
        subprocess.check_call(cmd, stdout=subprocess.DEVNULL)

    for app in squash.values():
        _fixup(app, squash, injections)

    _write_lockfile(apps)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
