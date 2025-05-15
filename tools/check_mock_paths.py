#! /usr/bin/env python
import ast
import importlib
import re
import sys
from pathlib import Path

from sentry.runner import configure

configure()

# List of built-in functions that are commonly mocked
BUILTIN_FUNCTIONS = {
    "super",
    "open",
    "print",
    "len",
    "range",
    "str",
    "int",
    "float",
    "bool",
    "list",
    "dict",
    "set",
    "tuple",
}


def is_valid_import_path(path_str: str) -> bool:
    """
    Tries to validate if a string path can be imported or an attribute accessed.
    """
    if not path_str or not isinstance(path_str, str) or "." not in path_str:
        return True  # Not a typical module path string, or not a string at all

    parts = path_str.split(".")
    module_path = parts[0]
    current_obj_path = module_path

    # Check if the last part is a built-in function
    if parts[-1] in BUILTIN_FUNCTIONS:
        return True

    try:
        # Try to import the top-level module
        module = importlib.import_module(module_path)
        current_obj = module

        # Traverse the rest of the path
        for i, part in enumerate(parts[1:]):
            current_obj_path += f".{part}"

            # First try to import the full path up to this point
            try:
                current_obj = importlib.import_module(current_obj_path)
                continue
            except ImportError:
                # If direct import fails, try to get the attribute
                if not hasattr(current_obj, part):
                    # Before failing, try one more time to import the parent module
                    # This handles cases where the parent module might have imported the child
                    try:
                        parent_module = importlib.import_module(".".join(parts[: i + 1]))
                        if hasattr(parent_module, part):
                            current_obj = getattr(parent_module, part)
                            continue
                    except ImportError:
                        pass

                    print(
                        f"Error: '{part}' not found in '{'.'.join(parts[:i+1])}' (full path: '{path_str}')"
                    )  # noqa: S002
                    return False
                current_obj = getattr(current_obj, part)
        return True
    except ImportError:
        print(f"Error: Could not import module/path '{path_str}'")
        return False
    except AttributeError:
        print(f"Error: Attribute error for path '{path_str}'")
        return False
    except Exception as e:
        print(f"Unexpected error validating path '{path_str}': {e}")
        return False  # Fail safe


class MockVisitor(ast.NodeVisitor):
    def __init__(self, filepath: str) -> None:
        self.filepath = filepath
        self.errors_found = False

    def visit_Call(self, node: ast.Call) -> None:
        # Check for `mocker.patch`, `patch`, `unittest.mock.patch`
        # This needs to be robust: could be `Call(Attribute(Name(id='mocker'), 'patch'))`
        # or `Call(Name(id='patch'))` etc.
        patch_call_name = ""
        if isinstance(node.func, ast.Attribute):  # e.g., mocker.patch, self.patch
            if isinstance(node.func.value, ast.Name):  # mocker.patch
                patch_call_name = f"{node.func.value.id}.{node.func.attr}"
            elif isinstance(node.func.value, ast.Attribute):  # e.g. unittest.mock.patch
                if isinstance(node.func.value.value, ast.Name):
                    patch_call_name = (
                        f"{node.func.value.value.id}.{node.func.value.attr}.{node.func.attr}"
                    )

        elif isinstance(node.func, ast.Name):  # e.g. patch (if imported directly)
            patch_call_name = node.func.id

        is_patch_call = any(
            name in patch_call_name for name in ["patch", "mocker.patch", "unittest.mock.patch"]
        )
        # Avoid patch.object's first arg, patch.dict, etc. for this simple check
        is_patch_object = "patch.object" in patch_call_name or "patch.dict" in patch_call_name

        if is_patch_call and not is_patch_object and node.args:
            # We are interested in the first argument if it's a string literal
            first_arg = node.args[0]
            if isinstance(first_arg, ast.Constant) and isinstance(first_arg.value, str):
                path_to_check = first_arg.value
                if not is_valid_import_path(path_to_check):
                    print(f"{self.filepath}:{node.lineno}: Invalid mock target: '{path_to_check}'")
                    self.errors_found = True
            # Could extend to check f-strings if they are simple enough (ast.JoinedStr)
            # but that adds complexity.

        self.generic_visit(node)  # Continue visiting other nodes

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:  # For decorators @patch(...)
        self_visit_decorator_list(self, node)
        self.generic_visit(node)

    def visit_AsyncFunctionDef(
        self, node: ast.AsyncFunctionDef
    ) -> None:  # For decorators @patch(...)
        self_visit_decorator_list(self, node)
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:  # For decorators @patch(...)
        self_visit_decorator_list(self, node)
        self.generic_visit(node)


def self_visit_decorator_list(
    self: MockVisitor, node: ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef
) -> None:
    for decorator in node.decorator_list:
        # Check if decorator is a Call, e.g., @patch('...')
        if isinstance(decorator, ast.Call):
            decorator_name = ""
            if isinstance(decorator.func, ast.Name) and decorator.func.id == "patch":
                decorator_name = "patch"
            elif (
                isinstance(decorator.func, ast.Attribute) and decorator.func.attr == "patch"
            ):  # e.g. @mock.patch
                # you might want to get the full name like mock.patch here
                decorator_name = "patch"  # Simplified for this example

            if decorator_name == "patch" and decorator.args:
                first_arg = decorator.args[0]
                if isinstance(first_arg, ast.Constant) and isinstance(first_arg.value, str):
                    path_to_check = first_arg.value
                    if not is_valid_import_path(path_to_check):
                        print(
                            f"{self.filepath}:{decorator.lineno}: Invalid mock target in decorator: '{path_to_check}'"
                        )
                        self.errors_found = True
        # Could also check for Name, e.g. @patch_something if patch_something is an alias. More complex.


def find_test_files(root_dir: str = "tests") -> list[str]:
    """
    Recursively find all test files in the given directory.
    Returns a list of paths to test files.
    """
    test_files = []
    test_file_pattern = re.compile(r"(test_.*\.py|.*_test\.py)$")

    for path in Path(root_dir).rglob("*.py"):
        if test_file_pattern.search(path.name):
            test_files.append(str(path))

    return test_files


def main() -> None:
    all_errors_found = False
    test_files = find_test_files()

    for filename in test_files:
        try:
            with open(filename, encoding="utf-8") as f:
                content = f.read()
            tree = ast.parse(content, filename=filename)
            visitor = MockVisitor(filepath=filename)
            visitor.visit(tree)
            if visitor.errors_found:
                all_errors_found = True
        except SyntaxError as e:
            print(f"SyntaxError in {filename}:{e.lineno}: Could not parse file.")
            all_errors_found = True  # Count syntax errors as failures
        except Exception as e:
            print(f"Error processing file {filename}: {e}")
            all_errors_found = True

    if all_errors_found:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
