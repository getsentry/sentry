import sys


def in_test_environment():
    test_env_breadcrumbs = {"pytest", "vscode", "generate-backup-test-for-release"}
    return any(needle in sys.argv[0] for needle in test_env_breadcrumbs)
