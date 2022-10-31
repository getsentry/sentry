from typing import List


def trim_tree(tree: List[str], languages: List[str]) -> List[str]:
    """This takes the tree representation of a repo and returns the file paths for the languages"""

    def should_include_file(file_path: str) -> bool:
        include: bool = False
        # Currently we only support Pythonfiles
        if "python" in languages:
            include = file_path.endswith(".py") and not file_path.startswith("tests/")
        return include

    # XXX: We should optimize the data structure to be a tree from file to top src dir
    return [x["path"] for x in tree if x["type"] == "blob" and should_include_file(x["path"])]
