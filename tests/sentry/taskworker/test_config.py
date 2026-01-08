import ast
import inspect
from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest
from django.conf import settings

from sentry.conf.types.taskworker import crontab
from sentry.taskworker.registry import taskregistry


@pytest.fixture
def load_tasks() -> None:
    """Ensure that tasks are loaded for schedule tests"""
    for path in settings.TASKWORKER_IMPORTS:
        __import__(path)


def test_import_paths() -> None:
    for path in settings.TASKWORKER_IMPORTS:
        try:
            __import__(path)
        except ImportError:
            raise AssertionError(f"Unable to import {path} from TASKWORKER_IMPORTS")


def test_taskworker_schedule_unique() -> None:
    visited: dict[str, str] = {}
    for key, entry in settings.TASKWORKER_SCHEDULES.items():
        if entry["task"] in visited:
            msg = (
                f"Schedule {key} references a task ({entry['task']}) "
                f"that is already scheduled under key {visited[entry['task']]}."
            )
            raise AssertionError(msg)

        visited[entry["task"]] = key


@pytest.mark.parametrize("name,config", list(settings.TASKWORKER_SCHEDULES.items()))
def test_taskworker_schedule_type(name: str, config: dict[str, Any], load_tasks) -> None:
    assert config["task"], f"schedule {name} is missing a task name"
    (namespace, taskname) = config["task"].split(":")
    assert taskregistry.get_task(namespace, taskname), f"task for {name} is not registered"

    assert config["schedule"], f"Schedule {name} is missing a schedule"
    schedule = config.get("schedule")
    assert isinstance(
        schedule, (timedelta, crontab)
    ), f"Schedule {name} has a schedule of type {type(schedule)}"


def test_taskworker_schedule_parameters() -> None:
    for config in settings.TASKWORKER_SCHEDULES.values():
        (namespace, taskname) = config["task"].split(":")
        task = taskregistry.get_task(namespace, taskname)
        signature = inspect.signature(task)

        for parameter in signature.parameters.values():
            # Skip *args and **kwargs
            if parameter.kind in (parameter.VAR_POSITIONAL, parameter.VAR_KEYWORD):
                continue
            if parameter.default == parameter.empty:
                raise AssertionError(
                    f"Parameter `{parameter.name}` for task `{task.name}` must have a default value."
                )


def test_all_instrumented_tasks_registered() -> None:
    """
    Verify all @instrumented_task decorators are registered in TASKWORKER_IMPORTS.

    This prevents production issues where tasks are defined but not discoverable
    by the taskworker because their module wasn't imported.
    """
    src_dir = Path(__file__).parent.parent.parent.parent / "src"

    task_modules = set()

    for py_file in src_dir.rglob("*.py"):
        if not py_file.is_file():
            continue

        try:
            content = py_file.read_text()

            if "@instrumented_task" not in content:
                continue

            tree = ast.parse(content)

            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    for decorator in node.decorator_list:
                        decorator_name = None
                        if isinstance(decorator, ast.Name):
                            decorator_name = decorator.id
                        elif isinstance(decorator, ast.Call) and isinstance(
                            decorator.func, ast.Name
                        ):
                            decorator_name = decorator.func.id

                        if decorator_name == "instrumented_task":
                            relative_path = py_file.relative_to(src_dir)
                            module_path = str(relative_path.with_suffix("")).replace("/", ".")
                            task_modules.add(module_path)
                            break
        except Exception:
            continue

    registered_imports = set(settings.TASKWORKER_IMPORTS)

    missing_modules = task_modules - registered_imports

    if missing_modules:
        missing_list = "\n  - ".join(sorted(missing_modules))
        raise AssertionError(
            f"Found {len(missing_modules)} module(s) with @instrumented_task that are NOT registered in TASKWORKER_IMPORTS.\n"
            f"These tasks will not be discovered by the taskworker in production!\n\n"
            f"Missing modules:\n  - {missing_list}\n\n"
            f"Add these to TASKWORKER_IMPORTS in src/sentry/conf/server.py"
        )
