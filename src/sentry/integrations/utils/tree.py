from typing import Dict, List

from sentry.utils.json import JSONData


def trim_tree(tree: JSONData, languages: List[str]) -> List[str]:
    """This takes the tree representation of a repo and returns the file paths for the languages"""

    def should_include_file(file_path: str) -> bool:
        include: bool = False
        # Currently we only support Pythonfiles
        if "python" in languages:
            include = file_path.endswith(".py") and not file_path.startswith("tests/")
        return include

    # This help with mypy typing
    def get_meta(file_meta: Dict[str, str]) -> str:
        return file_meta["path"]

    # XXX: We should optimize the data structure to be a tree from file to top src dir
    return list(
        map(
            get_meta,
            filter(
                lambda x: x["type"] == "blob" and should_include_file(x["path"]),
                tree,
            ),
        )
    )
