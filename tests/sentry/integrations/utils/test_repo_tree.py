import os

from sentry.integrations.utils.repo_tree import partitioned_files
from sentry.utils import json

with open(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures/sentry_files.json")
) as fd:
    sentry_files = json.load(fd)


def test_partition_files():
    partitioned_tree = partitioned_files(sentry_files)
    assert len(partitioned_tree.keys()) == 3

    assert partitioned_tree["py"][0] == "bin/__init__.py"
    assert partitioned_tree["js"][0] == "docs-ui/.eslintrc.js"
