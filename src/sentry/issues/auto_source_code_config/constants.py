SUPPORTED_INTEGRATIONS = ["github"]
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
DRY_RUN_PLATFORMS: list[str] = []
# Some languages will also process system frames
PROCESS_ALL_FRAMES: list[str] = []
