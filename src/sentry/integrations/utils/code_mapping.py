from __future__ import annotations

import logging
from typing import NamedTuple

from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.services.hybrid_cloud.integration.model import RpcOrganizationIntegration
from sentry.utils.event_frames import EventFrame, try_munge_frame_path

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

SLASH = "/"
BACKSLASH = "\\"  # This is the Python representation of a single backslash

# Read this to learn about file extensions for different languages
# https://github.com/github/linguist/blob/master/lib/linguist/languages.yml
# We only care about the ones that would show up in stacktraces after symbolication
EXTENSIONS = ["js", "jsx", "tsx", "ts", "mjs", "py", "rb", "rake", "php", "go"]

# List of file paths prefixes that should become stack trace roots
FILE_PATH_PREFIX_LENGTH = {
    "app:///": 7,
    "../": 3,
    "./": 2,
}

# We want tasks which hit the GH API multiple times to give up if they hit too many
# "can't reach GitHub"-type errors.
MAX_CONNECTION_ERRORS = 10


class Repo(NamedTuple):
    name: str
    branch: str


class RepoTree(NamedTuple):
    repo: Repo
    files: list[str]


class CodeMapping(NamedTuple):
    repo: Repo
    stacktrace_root: str
    source_path: str


class UnsupportedFrameFilename(Exception):
    pass


def get_extension(file_path: str) -> str:
    extension = ""
    if file_path:
        ext_period = file_path.rfind(".")
        if ext_period >= 1:  # e.g. f.py
            extension = file_path.rsplit(".")[-1]

    return extension


def should_include(file_path: str) -> bool:
    include = True
    if file_path.endswith("spec.jsx") or file_path.startswith("tests/"):
        include = False
    return include


def get_straight_path_prefix_end_index(file_path: str) -> int:
    index = 0
    for prefix in FILE_PATH_PREFIX_LENGTH:
        while file_path.startswith(prefix):
            index += FILE_PATH_PREFIX_LENGTH[prefix]
            file_path = file_path[FILE_PATH_PREFIX_LENGTH[prefix] :]
    return index


def remove_straight_path_prefix(file_path: str) -> str:
    return file_path[get_straight_path_prefix_end_index(file_path) :]


def filter_source_code_files(files: list[str]) -> list[str]:
    """
    This takes the list of files of a repo and returns
    the file paths for supported source code files
    """
    _supported_files = []
    # XXX: If we want to make the data structure faster to traverse, we could
    # use a tree where each leaf represents a file while non-leaves would
    # represent a directory in the path
    for file_path in files:
        try:
            extension = get_extension(file_path)
            if extension in EXTENSIONS and should_include(file_path):
                _supported_files.append(file_path)
        except Exception:
            logger.exception("We've failed to store the file path.")

    return _supported_files


def convert_stacktrace_frame_path_to_source_path(
    frame: EventFrame,
    code_mapping: RepositoryProjectPathConfig,
    platform: str | None,
    sdk_name: str | None,
) -> str | None:
    """
    Applies the given code mapping to the given stacktrace frame and returns the source path.

    If the code mapping does not apply to the frame, returns None.
    """

    # In most cases, code mappings get applied to frame.filename, but some platforms such as Java
    # contain folder info in other parts of the frame (e.g. frame.module="com.example.app.MainActivity"
    # gets transformed to "com/example/app/MainActivity.java"), so in those cases we use the
    # transformed path instead.
    stacktrace_path = (
        try_munge_frame_path(frame=frame, platform=platform, sdk_name=sdk_name) or frame.filename
    )

    if stacktrace_path and stacktrace_path.startswith(code_mapping.stack_root):
        return stacktrace_path.replace(code_mapping.stack_root, code_mapping.source_root, 1)

    # Some platforms only provide the file's name without folder paths, so we
    # need to use the absolute path instead. If the code mapping has a non-empty
    # stack_root value and it matches the absolute path, we do the mapping on it.
    if frame.abs_path and frame.abs_path.startswith(code_mapping.stack_root):
        return frame.abs_path.replace(code_mapping.stack_root, code_mapping.source_root, 1)

    return None


# XXX: Look at sentry.interfaces.stacktrace and maybe use that
class FrameFilename:
    def __init__(self, frame_file_path: str) -> None:
        self.raw_path = frame_file_path
        if frame_file_path[0] == "/":
            frame_file_path = frame_file_path.replace("/", "", 1)

        # Using regexes would be better but this is easier to understand
        if (
            not frame_file_path
            or frame_file_path[0] in ["[", "<"]
            or frame_file_path.find(" ") > -1
            or frame_file_path.find("\\") > -1  # Windows support
            or frame_file_path.find("/") == -1
        ):
            raise UnsupportedFrameFilename("This path is not supported.")

        self.full_path = frame_file_path
        self.extension = get_extension(frame_file_path)
        if not self.extension:
            raise UnsupportedFrameFilename("It needs an extension.")
        if self.frame_type() == "packaged":
            self._packaged_logic(frame_file_path)
        else:
            self._straight_path_logic(frame_file_path)

    def frame_type(self) -> str:
        type = "packaged"
        if self.extension not in ["py"]:
            type = "straight_path"
        return type

    def _packaged_logic(self, frame_file_path: str) -> None:
        self.root, self.file_and_dir_path = frame_file_path.split("/", 1)

        # Check that it does have at least a dir
        if self.file_and_dir_path.find("/") > -1:
            self.dir_path, self.file_name = self.file_and_dir_path.rsplit("/", 1)
        else:
            # A package name, a file but no dir (e.g. requests/models.py)
            self.dir_path = ""
            self.file_name = self.file_and_dir_path

    def _straight_path_logic(self, frame_file_path: str) -> None:
        # Cases:
        # - some/path/foo.tsx
        # - ./some/path/foo.tsx
        # - /some/path/foo.js
        # - app:///some/path/foo.js
        # - ../../../some/path/foo.js
        # - app:///../some/path/foo.js

        start_at_index = get_straight_path_prefix_end_index(frame_file_path)
        slash_index = frame_file_path.find("/", start_at_index)
        dir_path, self.file_name = frame_file_path.rsplit("/", 1)  # foo.tsx (both)
        self.root = frame_file_path[0:slash_index]  # some or .some
        self.dir_path = dir_path.replace(self.root, "")  # some/path/ (both)
        self.file_and_dir_path = remove_straight_path_prefix(
            frame_file_path
        )  # some/path/foo.tsx (both)

    def __repr__(self) -> str:
        return f"FrameFilename: {self.full_path}"

    def __eq__(self, other) -> bool:
        return self.full_path == other.full_path


def stacktrace_buckets(stacktraces: list[str]) -> dict[str, list[FrameFilename]]:
    buckets: dict[str, list[FrameFilename]] = {}
    for stacktrace_frame_file_path in stacktraces:
        try:
            frame_filename = FrameFilename(stacktrace_frame_file_path)
            # Any files without a top directory will be grouped together
            bucket_key = frame_filename.root

            if not buckets.get(bucket_key):
                buckets[bucket_key] = []
            buckets[bucket_key].append(frame_filename)

        except UnsupportedFrameFilename:
            logger.info("Frame's filepath not supported: %s", stacktrace_frame_file_path)
        except Exception:
            logger.exception("Unable to split stacktrace path into buckets")

    return buckets


# call generate_code_mappings() after you initialize CodeMappingTreesHelper
class CodeMappingTreesHelper:
    def __init__(self, trees: dict[str, RepoTree]):
        self.trees = trees
        self.code_mappings: dict[str, CodeMapping] = {}

    def process_stackframes(self, buckets: dict[str, list[FrameFilename]]) -> bool:
        """This processes all stackframes and returns if a new code mapping has been generated"""
        reprocess = False
        for stackframe_root, stackframes in buckets.items():
            if not self.code_mappings.get(stackframe_root):
                for frame_filename in stackframes:
                    code_mapping = self._find_code_mapping(frame_filename)
                    if code_mapping:
                        # This allows processing some stack frames that
                        # were matching more than one file
                        reprocess = True
                        self.code_mappings[stackframe_root] = code_mapping
        return reprocess

    def generate_code_mappings(self, stacktraces: list[str]) -> list[CodeMapping]:
        """Generate code mappings based on the initial trees object and the list of stack traces"""
        # We need to make sure that calling this method with a new list of stack traces
        # should always start with a clean slate
        self.code_mappings = {}
        buckets: dict[str, list[FrameFilename]] = stacktrace_buckets(stacktraces)

        # We reprocess stackframes until we are told that no code mappings were produced
        # This is order to reprocess past stackframes in light of newly discovered code mappings
        # This allows for idempotency since the order of the stackframes will not matter
        # This has no performance issue because stackframes that match an existing code mapping
        # will be skipped
        while True:
            if not self.process_stackframes(buckets):
                break

        return list(self.code_mappings.values())

    def _find_code_mapping(self, frame_filename: FrameFilename) -> CodeMapping | None:
        """Look for the file path through all the trees and generate code mappings for it"""
        _code_mappings: list[CodeMapping] = []
        # XXX: This will need optimization by changing the data structure of the trees
        for repo_full_name in self.trees.keys():
            try:
                _code_mappings.extend(
                    self._generate_code_mapping_from_tree(
                        self.trees[repo_full_name], frame_filename
                    )
                )
            except NotImplementedError:
                logger.exception(
                    "Code mapping failed for module with no package name. Processing continues."
                )
            except Exception:
                logger.exception("Unexpected error. Processing continues.")

        if len(_code_mappings) == 0:
            logger.warning("No files matched for %s", frame_filename.full_path)
            return None
        # This means that the file has been found in more than one repo
        elif len(_code_mappings) > 1:
            logger.warning("More than one repo matched %s", frame_filename.full_path)
            return None

        return _code_mappings[0]

    def list_file_matches(self, frame_filename: FrameFilename) -> list[dict[str, str]]:
        file_matches = []
        for repo_full_name in self.trees.keys():
            repo_tree = self.trees[repo_full_name]
            matches = [
                src_path
                for src_path in repo_tree.files
                if self._potential_match(src_path, frame_filename)
            ]

            for file in matches:
                stacktrace_root, source_path = find_roots(frame_filename.raw_path, file)
                file_matches.append(
                    {
                        "filename": file,
                        "repo_name": repo_tree.repo.name,
                        "repo_branch": repo_tree.repo.branch,
                        "stacktrace_root": stacktrace_root,
                        "source_path": source_path,
                    }
                )
        return file_matches

    def _generate_code_mapping_from_tree(
        self,
        repo_tree: RepoTree,
        frame_filename: FrameFilename,
    ) -> list[CodeMapping]:
        matched_files = [
            src_path
            for src_path in repo_tree.files
            if self._potential_match(src_path, frame_filename)
        ]
        if len(matched_files) != 1:
            return []

        stacktrace_root, source_path = find_roots(frame_filename.raw_path, matched_files[0])
        # It is too risky generating code mappings when there's more
        # than one file potentially matching
        return [
            CodeMapping(
                repo=repo_tree.repo,
                stacktrace_root=stacktrace_root,  # sentry/
                source_path=source_path,  # src/sentry/
            )
        ]

    def _matches_current_code_mappings(self, src_file: str, frame_filename: FrameFilename) -> bool:
        # In some cases, once we have derived a code mapping we can exclude files that start with
        # that source path.
        #
        # For instance sentry_plugins/slack/client.py matches these files
        # - "src/sentry_plugins/slack/client.py",
        # - "src/sentry/integrations/slack/client.py",
        return any(
            code_mapping.source_path
            for code_mapping in self.code_mappings.values()
            if src_file.startswith(f"{code_mapping.source_path}/")
        )

    def _potential_match_with_transformation(
        self, src_file: str, frame_filename: FrameFilename
    ) -> bool:
        """Determine if the frame filename represents a source code file.

        Languages like Python include the package name at the front of the frame_filename, thus, we need
        to drop it before we try to match it.
        """
        match = False
        # For instance:
        #  src_file: "src/sentry/integrations/slack/client.py"
        #  frame_filename.full_path: "sentry/integrations/slack/client.py"
        # This should not match:
        #  src_file: "src/sentry/utils/uwsgi.py"
        #  frame_filename: "sentry/wsgi.py"
        split = src_file.split(f"/{frame_filename.file_and_dir_path}")
        if any(split) and len(split) > 1:
            # This is important because we only want stack frames to match when they
            # include the exact package name
            # e.g. raven/base.py stackframe should not match this source file: apostello/views/base.py
            match = (
                split[0].rfind(f"/{frame_filename.root}") > -1 or split[0] == frame_filename.root
            )
        return match

    def _potential_match_no_transformation(
        self, src_file: str, frame_filename: FrameFilename
    ) -> bool:
        # src_file: static/app/utils/handleXhrErrorResponse.tsx
        # full_name: ./app/utils/handleXhrErrorResponse.tsx
        # file_and_dir_path: app/utils/handleXhrErrorResponse.tsx
        return src_file.rfind(frame_filename.file_and_dir_path) > -1

    def _potential_match(self, src_file: str, frame_filename: FrameFilename) -> bool:
        """Tries to see if the stacktrace without the root matches the file from the
        source code. Use existing code mappings to exclude some source files
        """
        # Exit early because we should not be processing source files for existing code maps
        if self._matches_current_code_mappings(src_file, frame_filename):
            return False

        match = False
        if frame_filename.full_path.endswith(".py"):
            match = self._potential_match_with_transformation(src_file, frame_filename)
        else:
            match = self._potential_match_no_transformation(src_file, frame_filename)

        return match


def create_code_mapping(
    organization_integration: OrganizationIntegration | RpcOrganizationIntegration,
    project: Project,
    code_mapping: CodeMapping,
) -> RepositoryProjectPathConfig:
    repository, _ = Repository.objects.get_or_create(
        name=code_mapping.repo.name,
        organization_id=organization_integration.organization_id,
        defaults={
            "integration_id": organization_integration.integration_id,
        },
    )

    new_code_mapping, created = RepositoryProjectPathConfig.objects.update_or_create(
        project=project,
        stack_root=code_mapping.stacktrace_root,
        defaults={
            "repository": repository,
            "organization_id": organization_integration.organization_id,
            "integration_id": organization_integration.integration_id,
            "organization_integration_id": organization_integration.id,
            "source_root": code_mapping.source_path,
            "default_branch": code_mapping.repo.branch,
            "automatically_generated": True,
        },
    )

    if created:
        logger.info(
            "Created a code mapping for project.slug=%s, stack root: %s",
            project.slug,
            code_mapping.stacktrace_root,
        )
    else:
        logger.info(
            "Updated existing code mapping for project.slug=%s, stack root: %s",
            project.slug,
            code_mapping.stacktrace_root,
        )

    return new_code_mapping


def get_sorted_code_mapping_configs(project: Project) -> list[RepositoryProjectPathConfig]:
    """
    Returns the code mapping config list for a project sorted based on precedence.
    User generated code mappings are evaluated before Sentry generated code mappings.
    Code mappings with absolute path stack roots are evaluated before relative path stack roots.
    Code mappings with more defined stack trace roots are evaluated before less defined stack trace
    roots.

    `project`: The project to get the list of sorted code mapping configs for
    """

    # xxx(meredith): if there are ever any changes to this query, make
    # sure that we are still ordering by `id` because we want to make sure
    # the ordering is deterministic
    # codepath mappings must have an associated integration for stacktrace linking.
    configs = RepositoryProjectPathConfig.objects.filter(
        project=project, organization_integration_id__isnull=False
    )

    sorted_configs: list[RepositoryProjectPathConfig] = []

    try:
        for config in configs:
            inserted = False
            for index, sorted_config in enumerate(sorted_configs):
                # This check will ensure that all user defined code mappings will come before Sentry generated ones
                if (
                    (sorted_config.automatically_generated and not config.automatically_generated)
                    or (  # Insert absolute paths before relative paths
                        not sorted_config.stack_root.startswith("/")
                        and config.stack_root.startswith("/")
                    )
                    or (  # Insert more defined stack roots before less defined ones
                        (sorted_config.automatically_generated == config.automatically_generated)
                        and config.stack_root.startswith(sorted_config.stack_root)
                    )
                ):
                    sorted_configs.insert(index, config)
                    inserted = True
                    break
            if not inserted:
                # Insert the code mapping at the back if it's Sentry generated or at the front if it is user defined
                if config.automatically_generated:
                    sorted_configs.insert(len(sorted_configs), config)
                else:
                    sorted_configs.insert(0, config)
    except Exception:
        logger.exception("There was a failure sorting the code mappings")

    return sorted_configs


def find_roots(stack_path: str, source_path: str) -> tuple[str, str]:
    """
    Returns a tuple containing the stack_root, and the source_root.
    If there is no overlap, raise an exception since this should not happen
    """
    stack_path_delim = SLASH if SLASH in stack_path else BACKSLASH
    overlap_to_check = stack_path.split(stack_path_delim)
    stack_root_items: list[str] = []
    while overlap_to_check:
        if source_path.endswith(overlap := SLASH.join(overlap_to_check)):
            source_root = source_path.rpartition(overlap)[0]
            stack_root = stack_path_delim.join(stack_root_items)

            if stack_root:  # append trailing slash
                stack_root = f"{stack_root}{stack_path_delim}"
            if source_root and source_root[-1] != SLASH:
                source_root = f"{source_root}{SLASH}"
            if stack_path.endswith(".py") and len(overlap_to_check) > 1:
                next_dir = overlap_to_check[0]
                stack_root = f"{stack_root}{next_dir}{stack_path_delim}"
                source_root = f"{source_root}{next_dir}{SLASH}"

            return (stack_root, source_root)

        # increase stack root specificity, decrease overlap specifity
        stack_root_items.append(overlap_to_check.pop(0))

    # validate_source_url should have ensured the file names match
    # so if we get here something went wrong and there is a bug
    raise Exception("Could not find common root from paths")
