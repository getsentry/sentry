from sentry import options

SUPPORTED_INTEGRATIONS = ["github"]
# XXX: We may want to change these constants into a configuration object
# Any new languages should also require updating the stacktraceLink.tsx and repo_trees.py SUPPORTED_EXTENSIONS
SUPPORTED_LANGUAGES = [
    "csharp",
    "go",
    "javascript",
    "node",
    "php",
    "python",
    "ruby",
]
# These languages will run as dry-run mode by default
DRY_RUN_PLATFORMS: list[str] = options.get("issues.auto_source_code_config.dry-run-platforms")
# Some languages will also process system frames
PROCESS_ALL_FRAMES: list[str] = ["java"]
# Extract filename from module and abs_path
# e.g. com.foo.bar.Baz$handle$1, Baz.kt -> com/foo/bar/Baz.kt
EXTRACT_FILENAME_FROM_MODULE_AND_ABS_PATH = ["java"]
