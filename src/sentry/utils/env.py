import sys


def in_test_environment():
    return "pytest" in sys.argv[0] or "vscode" in sys.argv[0]
