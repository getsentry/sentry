import os
import re
from typing import Iterable, Tuple


def apply_decorators(
    decorator_name: str,
    import_stmt: str,
    target_names: Iterable[Tuple[str, str]],
) -> None:
    def find_source_paths():
        for (dirpath, dirnames, filenames) in os.walk("./src/sentry"):
            for filename in filenames:
                if filename.endswith(".py"):
                    yield os.path.join(dirpath, filename)

    def find_class_declarations():
        for src_path in find_source_paths():
            with open(src_path) as f:
                src_code = f.read()
            for match in re.findall(r"\nclass\s+(\w+)\(", src_code):
                yield src_path, match

    def insert_import(src_code: str) -> str:
        future_import = None
        for future_import in re.finditer(r"from\s+__future__\s+.*\n+", src_code):
            pass  # iterate to last match
        if future_import:
            start, end = future_import.span()
            return src_code[:end] + import_stmt + "\n" + src_code[end:]
        else:
            return import_stmt + "\n" + src_code

    def is_module(src_path: str, module_name: str) -> bool:
        if module_name is None:
            return False
        suffix = ".py"
        return src_path.endswith(suffix) and (
            src_path[: -len(suffix)].replace("/", ".").endswith(module_name)
        )

    targets = {class_name: module_name for (module_name, class_name) in target_names}
    for src_path, class_name in find_class_declarations():
        if is_module(src_path, targets.get(class_name)):
            with open(src_path) as f:
                src_code = f.read()
            new_code = re.sub(
                rf"\nclass\s+{class_name}\(",
                rf"\n@{decorator_name}\g<0>",
                src_code,
            )
            new_code = insert_import(new_code)
            with open(src_path, mode="w") as f:
                f.write(new_code)


def _parse_camelcase_name(name: str) -> Iterable[str]:
    return re.findall("[A-Z][a-z]*", name)


def has_customer_name(name: str) -> bool:
    keywords = ("Organization", "Project", "Team", "Group", "Event", "Issue")
    name_words = _parse_camelcase_name(name)
    return any(w in name_words for w in keywords) and ("JiraIssue" not in name)


def has_control_name(name: str) -> bool:
    if has_customer_name(name):
        return False
    keywords = ("User", "Auth", "Identity")
    name_words = _parse_camelcase_name(name)
    return any(w in name_words for w in keywords) and ("JiraIssue" not in name)
