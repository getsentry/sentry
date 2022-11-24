import logging
from typing import Dict, List, NamedTuple

logger = logging.getLogger(__name__)


class Repo(NamedTuple):
    name: str
    branch: str


class RepoTree(NamedTuple):
    repo: Repo
    files: List[str]


# Read this to learn about file extensions for different languages
# https://github.com/github/linguist/blob/master/lib/linguist/languages.yml
# We only care about the ones that would show up in stacktraces after symbolication
EXTENSIONS = ["js", "tsx", "py"]


def partitioned_files(files: List[str]) -> Dict[str, List[str]]:
    """This takes the tree representation of a repo and returns the file paths for the languages"""
    new_tree = {}

    def store_if_supported(file_path: str) -> bool:
        ext_period = file_path.find(".")
        if ext_period > 0:
            extension = file_path.rsplit(".")[-1]
            if extension not in EXTENSIONS:
                logger.debug(f"We do not support the .{extension} extension.")
            else:
                if extension not in new_tree:
                    new_tree[extension] = []
                new_tree[extension].append(file_path)
        else:
            logger.debug("Just a file without extension.")

    # XXX: We should optimize the data structure to be a tree from file to top src dir
    for _file_path in files:
        try:
            store_if_supported(_file_path)
        except Exception:
            logger.exception("We've failed to store the file path.")

    return new_tree
