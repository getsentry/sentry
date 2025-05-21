import ast
import collections
import graphlib
import os.path
import subprocess
from typing import NamedTuple

# for squash
_SAFE_RUN_SQL_IMPORT = "from sentry.new_migrations.monkey.special import SafeRunSQL\n"
_GIST_EXT = """\
        # would be nice but it doesn't support hints :(
        # django.contrib.postgres.operations.BtreeGistExtension(),
        SafeRunSQL(
            sql="CREATE EXTENSION btree_gist;",
            reverse_sql="",
            hints={"tables": ["accounts_spend_allocations"]},
        ),
"""


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
    def squash_name(self) -> str:
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
    else:
        return f"src/sentry/{app}/migrations"


def _is_migration(fname: str) -> bool:
    return fname.startswith("0") and fname.endswith(".py")


def _get_replaces(root: str) -> list[str]:
    ret = []
    for fname in os.listdir(root):
        if _is_migration(fname):
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


def _find_migration(app: App, n: int) -> str:
    (fname,) = (
        fname
        for fname in os.listdir(app.root)
        if _is_migration(fname) and fname.startswith(f"{n:04}_")
    )
    return os.path.join(app.root, fname)


class FindReplaces(ast.NodeVisitor):
    def __init__(self) -> None:
        self.replaces_range: slice | None = None

    def visit_Assign(self, node: ast.Assign) -> None:
        if _is_assign_to(node, "replaces"):
            self.replaces_range = slice(node.lineno - 1, node.end_lineno)

        self.generic_visit(node)


def _clear_out_replaces(apps: list[App]) -> None:
    for app in apps:
        fname = _find_migration(app, 1)

        with open(fname, encoding="UTF-8") as f:
            lines = list(f)

        visitor = FindReplaces()
        visitor.visit(ast.parse("".join(lines), filename=fname))

        if visitor.replaces_range is not None:
            del lines[visitor.replaces_range]

            with open(fname, "w", encoding="UTF-8") as f:
                f.writelines(lines)


def _clean_one_depends(app: App) -> dict[str, set[str]]:
    ret: dict[str, set[str]]
    ret = collections.defaultdict(set)
    for fname in os.listdir(app.root):
        if not _is_migration(fname):
            continue

        joined = os.path.join(app.root, fname)
        with open(joined, encoding="UTF-8") as f:
            lines = list(f)

        tree = ast.parse("".join(lines), filename=joined)

        fixups = []
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
                            ret[cand].add(fname.removesuffix(".py"))
                            fixups.append(elt.lineno)

        if fixups:
            for fixup in fixups:
                lines[fixup - 1] = lines[fixup - 1].replace("(", "# (", count=1)
            with open(joined, "w", encoding="UTF-8") as f:
                f.writelines(lines)

    subprocess.check_call(("git", "add", app.root))

    return ret


def _clear_out_depends(apps: list[App]) -> dict[str, dict[str, set[str]]]:
    return {app.name: _clean_one_depends(app) for app in apps}


class FixupVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.initial_lineno: int | None = None
        self.is_post_deployment_lineno: int | None = None
        self.first_exclude_constraint: int | None = None

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
                self.first_exclude_constraint = node.lineno

        self.generic_visit(node)


def _fixup(fname: str, replaces: list[tuple[str, str]]) -> None:
    with open(fname, encoding="UTF-8") as f:
        lines = list(f)

    visitor = FixupVisitor()
    visitor.visit(ast.parse("".join(lines), filename=fname))

    if visitor.first_exclude_constraint is not None:
        lines.insert(visitor.first_exclude_constraint - 1, _GIST_EXT)

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

    with open(fname, "w", encoding="UTF-8") as f:
        f.writelines(lines)


def _squash_one(repo: str, app: App) -> None:
    print(f"squashing {app.name}...")
    for fname in os.listdir(app.root):
        if _is_migration(fname):
            os.remove(os.path.join(app.root, fname))

    name = f"squashed_{app.current}"
    cmd = (repo, "django", "makemigrations", app.name, "-n", name)
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL)

    replaces = [(app.name, mod) for mod in app.replaces]
    _fixup(app.squash_fname, replaces)


def _remove_sentry_references(apps: list[App]) -> None:
    for app in apps:
        if app.name == "sentry":
            continue

        with open(app.squash_fname, encoding="UTF-8") as f:
            lines = list(f)

        lines = [
            line.replace("(", "# (", count=1) if line.startswith('        ("sentry", ') else line
            for line in lines
        ]

        with open(app.squash_fname, "w", encoding="UTF-8") as f:
            f.writelines(lines)


class RemoveWorkflowEngineVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.dependencies_range: slice | None = None
        self.fkey_range: slice | None = None
        self.constraint_range: slice | None = None

    def visit_Assign(self, node: ast.Assign) -> None:
        if _is_assign_to(node, "dependencies"):
            self.dependencies_range = slice(node.lineno - 1, node.end_lineno)

        self.generic_visit(node)

    def visit_Tuple(self, node: ast.Tuple) -> None:
        if (
            len(node.elts) == 2
            and isinstance(node.elts[0], ast.Constant)
            and node.elts[0].value == "action"
            and isinstance(node.elts[1], ast.Call)
            and isinstance(node.elts[1].func, ast.Attribute)
            and node.elts[1].func.attr == "FlexibleForeignKey"
        ):
            kw = _get_kw(node.elts[1].keywords, "to")
            if (
                kw is not None
                and isinstance(kw.value, ast.Constant)
                and kw.value.value == "workflow_engine.action"
            ):
                self.fkey_range = slice(node.lineno - 1, node.end_lineno)

        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        if isinstance(node.func, ast.Attribute) and node.func.attr == "AddConstraint":
            kw = _get_kw(node.keywords, "constraint")
            if kw is not None and isinstance(kw.value, ast.Call):
                kw = _get_kw(kw.value.keywords, "name")
                if (
                    kw is not None
                    and isinstance(kw.value, ast.Constant)
                    and kw.value.value == "notification_type_mutual_exclusivity"
                ):
                    self.constraint_range = slice(node.lineno - 1, node.end_lineno)

        self.generic_visit(node)


def _remove_workflow_engine(app: App) -> None:
    with open(app.squash_fname, encoding="UTF-8") as f:
        lines = list(f)

    visitor = RemoveWorkflowEngineVisitor()
    visitor.visit(ast.parse("".join(lines), filename=app.squash_fname))

    assert visitor.constraint_range is not None
    del lines[visitor.constraint_range]

    assert visitor.fkey_range is not None
    del lines[visitor.fkey_range]

    assert visitor.dependencies_range is not None
    lines[visitor.dependencies_range] = ["    dependencies = []\n"]

    with open(app.squash_fname, "w", encoding="UTF-8") as f:
        f.writelines(lines)


def _fix_sentry_cycle(repo: str, app: App, replaces: set[str]) -> None:
    name = "fix_workflow_engine_cycle"
    cmd = (repo, "django", "makemigrations", app.name, "-n", name)
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL)

    n = int(app.current.split("_")[0]) + 1
    fname = os.path.join(app.root, f"{n:04}_{name}.py")
    _fixup(fname, [(app.name, mod) for mod in sorted(replaces)])


def _fix_sentry_references(apps: list[App], sentry: App) -> None:
    for app in apps:
        with open(app.squash_fname, encoding="UTF-8") as f:
            lines = list(f)

        lines = [
            (
                f'        ("sentry", "{sentry.squash_name}"),\n'
                if line.startswith('        # ("sentry", ')
                else line
            )
            for line in lines
        ]

        with open(app.squash_fname, "w", encoding="UTF-8") as f:
            f.writelines(lines)


class DependenciesVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.dependencies_range: slice | None = None

    def visit_Assign(self, node: ast.Assign) -> None:
        if _is_assign_to(node, "dependencies"):
            self.dependencies_range = slice(node.lineno - 1, node.end_lineno)

        self.generic_visit(node)


def _fix_replaced(sentry: App, replaced: set[str]) -> None:
    for name in replaced:
        fname = _find_migration(sentry, int(name[:4]) + 1)

        with open(fname, encoding="UTF-8") as f:
            lines = list(f)

        visitor = DependenciesVisitor()
        visitor.visit(ast.parse("".join(lines), filename=fname))

        assert visitor.dependencies_range is not None
        lines[visitor.dependencies_range] = ["    dependencies = []\n"]

        with open(fname, "w", encoding="UTF-8") as f:
            f.writelines(lines)

    subprocess.check_call(("git", "add", "--", sentry.root))


def main() -> int:
    repo = _get_repo()
    apps = _parse_lockfile()
    by_name = {app.name: app for app in apps}

    print("clearing out previous squash replaces...")
    _clear_out_replaces(apps)

    print("clearing out cross-app dependencies...")
    deps = _clear_out_depends(apps)

    # hack around the sentry <=> workflow_engine cycle
    if "sentry" in deps:
        sentry_to_workflow_engine = deps["sentry"].pop("workflow_engine")
    else:
        sentry_to_workflow_engine = set()

    for v in deps.values():
        # remove cross-repo deps: consider them "done"
        for k in tuple(v):
            if k not in deps:
                v.pop(k)

    sorter = graphlib.TopologicalSorter(deps)
    sorter.prepare()
    while sorter.is_active():
        for node in sorter.get_ready():
            if node != "sentry":
                _squash_one(repo, by_name[node])
            sorter.done(node)

    # fix the cycle last
    if "sentry" in deps:
        sentry = by_name["sentry"]
        # we'll put these as replaces in the second migration
        sentry.replaces[:] = sorted(set(sentry.replaces) - sentry_to_workflow_engine)
        _remove_sentry_references(apps)
        _squash_one(repo, sentry)
        _remove_workflow_engine(sentry)
        _fix_sentry_cycle(repo, sentry, sentry_to_workflow_engine)
        _fix_sentry_references(apps, sentry)
        subprocess.check_call(("git", "checkout", "--", sentry.root))
        _fix_replaced(sentry, sentry_to_workflow_engine)

    # restore the old migration files for now
    subprocess.check_call(("git", "checkout", "--", *(app.root for app in apps)))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
