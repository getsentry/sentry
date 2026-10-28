import ast
from pathlib import Path

from tools.migrations.squash import _OUT_OF_STATE_INDEXES, App, _fixup

_SQUASH = """\
from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    is_post_deployment = False

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="GroupRelease",
            fields=[("id", models.BigAutoField(primary_key=True))],
            options={"db_table": "sentry_grouprelease"},
        ),
    ]
"""


def _squash(tmp_path: Path, app_name: str) -> str:
    (tmp_path / "0001_squash.py").write_text(_SQUASH)
    app = App(name=app_name, current="0002_latest", root=str(tmp_path), replaces=["0001_initial"])
    _fixup(app, {app_name: app})
    return Path(app.squash_fname).read_text()


def _operations(source: str) -> list[ast.expr]:
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Assign) and ast.unparse(node.targets[0]) == "operations":
            assert isinstance(node.value, ast.List)
            return node.value.elts
    raise AssertionError("no operations")


def test_appends_out_of_state_indexes_after_create_model(tmp_path: Path) -> None:
    source = _squash(tmp_path, "sentry")

    operations = _operations(source)
    assert ast.unparse(operations[0]).startswith("migrations.CreateModel(")
    sqls = []
    for op in operations[1:]:
        assert isinstance(op, ast.Call) and ast.unparse(op.func) == "SafeRunSQL"
        sqls.append(ast.literal_eval(op.keywords[0].value))
    assert sqls == [index.sql for index in _OUT_OF_STATE_INDEXES if index.app == "sentry"]
    assert source.count("import SafeRunSQL") == 1


def test_leaves_other_apps_alone(tmp_path: Path) -> None:
    source = _squash(tmp_path, "other")

    assert len(_operations(source)) == 1
    assert "SafeRunSQL" not in source
