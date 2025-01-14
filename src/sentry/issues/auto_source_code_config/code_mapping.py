from __future__ import annotations

import logging

from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.services.integration.model import RpcOrganizationIntegration
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.utils.event_frames import EventFrame, try_munge_frame_path

from .source_code_files import get_extension
from .types import CodeMapping, RepoTree

logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = ["javascript", "python", "node", "ruby", "php", "go", "csharp"]

SLASH = "/"
BACKSLASH = "\\"  # This is the Python representation of a single backslash

# List of file paths prefixes that should become stack trace roots
FILE_PATH_PREFIX_LENGTH = {
    "app:///": 7,
    "../": 3,
    "./": 2,
}


class UnexpectedPathException(Exception):
    pass


class UnsupportedFrameFilename(Exception):
    pass


# XXX: Look at sentry.interfaces.stacktrace and maybe use that
class FrameFilename:
    def __init__(self, frame_file_path: str) -> None:
        self.raw_path = frame_file_path
        is_windows_path = False
        if "\\" in frame_file_path:
            is_windows_path = True
            frame_file_path = frame_file_path.replace("\\", "/")

        if frame_file_path[0] == "/" or frame_file_path[0] == "\\":
            frame_file_path = frame_file_path[1:]

        # Using regexes would be better but this is easier to understand
        if (
            not frame_file_path
            or frame_file_path[0] in ["[", "<"]
            or frame_file_path.find(" ") > -1
            or frame_file_path.find("/") == -1
        ):
            raise UnsupportedFrameFilename("This path is not supported.")

        self.full_path = frame_file_path
        self.extension = get_extension(frame_file_path)
        if not self.extension:
            raise UnsupportedFrameFilename("It needs an extension.")

        # Remove drive letter if it exists
        if is_windows_path and frame_file_path[1] == ":":
            frame_file_path = frame_file_path[2:]
            # windows drive letters can be like C:\ or C:
            # so we need to remove the slash if it exists
            if frame_file_path[0] == "/":
                frame_file_path = frame_file_path[1:]

        start_at_index = get_straight_path_prefix_end_index(frame_file_path)
        self.straight_path_prefix = frame_file_path[:start_at_index]

        # We normalize the path to be as close to what the path would
        # look like in the source code repository, hence why we remove
        # the straight path prefix and drive letter
        self.normalized_path = frame_file_path[start_at_index:]
        if start_at_index == 0:
            self.root = frame_file_path.split("/")[0]
        else:
            slash_index = frame_file_path.find("/", start_at_index)
            self.root = frame_file_path[0:slash_index]

        self.file_name = frame_file_path.split("/")[-1]

    def __repr__(self) -> str:
        return f"FrameFilename: {self.full_path}"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, FrameFilename):
            return False
        return self.full_path == other.full_path


# call generate_code_mappings() after you initialize CodeMappingTreesHelper
class CodeMappingTreesHelper:
    def __init__(self, trees: dict[str, RepoTree]):
        self.trees = trees
        self.code_mappings: dict[str, CodeMapping] = {}

    def generate_code_mappings(self, stacktraces: list[str]) -> list[CodeMapping]:
        """Generate code mappings based on the initial trees object and the list of stack traces"""
        # We need to make sure that calling this method with a new list of stack traces
        # should always start with a clean slate
        self.code_mappings = {}
        buckets: dict[str, list[FrameFilename]] = self._stacktrace_buckets(stacktraces)

        # We reprocess stackframes until we are told that no code mappings were produced
        # This is order to reprocess past stackframes in light of newly discovered code mappings
        # This allows for idempotency since the order of the stackframes will not matter
        # This has no performance issue because stackframes that match an existing code mapping
        # will be skipped
        while True:
            if not self._process_stackframes(buckets):
                break

        return list(self.code_mappings.values())

    def list_file_matches(self, frame_filename: FrameFilename) -> list[dict[str, str]]:
        """List all the files in a repo that match the frame_filename"""
        file_matches = []
        for repo_full_name in self.trees.keys():
            repo_tree = self.trees[repo_full_name]
            matches = [
                src_path
                for src_path in repo_tree.files
                if self._is_potential_match(src_path, frame_filename)
            ]

            for file in matches:
                stack_path = frame_filename.raw_path
                source_path = file

                try:
                    stack_root, source_root = find_roots(stack_path, source_path)
                except UnexpectedPathException:
                    logger.info(
                        "Unexpected format for stack_path or source_path",
                        extra={"stack_path": stack_path, "source_path": source_path},
                    )
                    continue

                if stack_path.replace(stack_root, source_root, 1).replace("\\", "/") != source_path:
                    logger.info(
                        "Unexpected stack_path/source_path found. A code mapping was not generated.",
                        extra={
                            "stack_path": stack_path,
                            "source_path": source_path,
                            "stack_root": stack_root,
                            "source_root": source_root,
                        },
                    )
                else:
                    file_matches.append(
                        {
                            "filename": file,
                            "repo_name": repo_tree.repo.name,
                            "repo_branch": repo_tree.repo.branch,
                            "stacktrace_root": stack_root,
                            "source_path": source_root,
                        }
                    )
        return file_matches

    def _stacktrace_buckets(self, stacktraces: list[str]) -> dict[str, list[FrameFilename]]:
        """Groups stacktraces into buckets based on the root of the stacktrace path"""
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

    def _process_stackframes(self, buckets: dict[str, list[FrameFilename]]) -> bool:
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

    def _find_code_mapping(self, frame_filename: FrameFilename) -> CodeMapping | None:
        """Look for the file path through all the trees and a generate code mapping for it if a match is found"""
        code_mappings: list[CodeMapping] = []
        # XXX: This will need optimization by changing the data structure of the trees
        for repo_full_name in self.trees.keys():
            try:
                code_mappings.extend(
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

        if len(code_mappings) == 0:
            logger.warning("No files matched for %s", frame_filename.full_path)
            return None
        # This means that the file has been found in more than one repo
        elif len(code_mappings) > 1:
            logger.warning("More than one repo matched %s", frame_filename.full_path)
            return None

        return code_mappings[0]

    def _generate_code_mapping_from_tree(
        self,
        repo_tree: RepoTree,
        frame_filename: FrameFilename,
    ) -> list[CodeMapping]:
        """
        Finds a match in the repo tree and generates a code mapping for it. At most one code mapping is generated, if any.
        If more than one potential match is found, do not generate a code mapping and return an empty list.
        """
        matched_files = [
            src_path
            for src_path in repo_tree.files
            if self._is_potential_match(src_path, frame_filename)
        ]

        if len(matched_files) != 1:
            return []

        stack_path = frame_filename.raw_path
        source_path = matched_files[0]

        try:
            stack_root, source_root = find_roots(stack_path, source_path)
        except UnexpectedPathException:
            logger.info(
                "Unexpected format for stack_path or source_path",
                extra={"stack_path": stack_path, "source_path": source_path},
            )
            return []

        if stack_path.replace(stack_root, source_root, 1).replace("\\", "/") != source_path:
            logger.info(
                "Unexpected stack_path/source_path found. A code mapping was not generated.",
                extra={
                    "stack_path": stack_path,
                    "source_path": source_path,
                    "stack_root": stack_root,
                    "source_root": source_root,
                },
            )
            return []

        return [
            CodeMapping(
                repo=repo_tree.repo,
                stacktrace_root=stack_root,
                source_path=source_root,
            )
        ]

    def _is_potential_match(self, src_file: str, frame_filename: FrameFilename) -> bool:
        """
        Tries to see if the stacktrace without the root matches the file from the
        source code. Use existing code mappings to exclude some source files
        """

        def _list_endswith(l1: list[str], l2: list[str]) -> bool:
            if len(l2) > len(l1):
                l1, l2 = l2, l1
            l1_idx = len(l1) - 1
            l2_idx = len(l2) - 1

            while l2_idx >= 0:
                if l2[l2_idx] != l1[l1_idx]:
                    return False
                l1_idx -= 1
                l2_idx -= 1
            return True

        # Exit early because we should not be processing source files for existing code maps
        if self._matches_existing_code_mappings(src_file):
            return False

        src_file_items = src_file.split("/")
        frame_items = frame_filename.normalized_path.split("/")

        if len(src_file_items) > len(frame_items):  # Mono repos
            return _list_endswith(src_file_items, frame_items)
        elif len(frame_items) > len(src_file_items):  # Absolute paths
            return _list_endswith(frame_items, src_file_items)
        else:  # exact match
            return src_file == frame_filename.normalized_path

    def _matches_existing_code_mappings(self, src_file: str) -> bool:
        """Check if the source file is already covered by an existing code mapping"""
        return any(
            code_mapping.source_path
            for code_mapping in self.code_mappings.values()
            if src_file.startswith(f"{code_mapping.source_path}/")
        )


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

    stack_root = code_mapping.stack_root

    # In most cases, code mappings get applied to frame.filename, but some platforms such as Java
    # contain folder info in other parts of the frame (e.g. frame.module="com.example.app.MainActivity"
    # gets transformed to "com/example/app/MainActivity.java"), so in those cases we use the
    # transformed path instead.
    stacktrace_path = (
        try_munge_frame_path(frame=frame, platform=platform, sdk_name=sdk_name) or frame.filename
    )

    if stacktrace_path and stacktrace_path.startswith(code_mapping.stack_root):
        return (
            stacktrace_path.replace(stack_root, code_mapping.source_root, 1)
            .replace("\\", "/")
            .lstrip("/")
        )

    # Some platforms only provide the file's name without folder paths, so we
    # need to use the absolute path instead. If the code mapping has a non-empty
    # stack_root value and it matches the absolute path, we do the mapping on it.
    if frame.abs_path and frame.abs_path.startswith(code_mapping.stack_root):
        return (
            frame.abs_path.replace(stack_root, code_mapping.source_root, 1)
            .replace("\\", "/")
            .lstrip("/")
        )

    return None


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


def get_straight_path_prefix_end_index(file_path: str) -> int:
    """
    Get the index where the straight path prefix ends in the file path.
    This is  used for Node projects where the file path can start with
    "app:///", "../", or "./"
    """
    index = 0
    for prefix in FILE_PATH_PREFIX_LENGTH:
        while file_path.startswith(prefix):
            index += FILE_PATH_PREFIX_LENGTH[prefix]
            file_path = file_path[FILE_PATH_PREFIX_LENGTH[prefix] :]
    return index


def find_roots(stack_path: str, source_path: str) -> tuple[str, str]:
    """
    Returns a tuple containing the stack_root, and the source_root.
    If there is no overlap, raise an exception since this should not happen
    """
    stack_root = ""
    if stack_path[0] == "/" or stack_path[0] == "\\":
        stack_root += stack_path[0]
        stack_path = stack_path[1:]

    if stack_path == source_path:
        return (stack_root, "")
    elif source_path.endswith(stack_path):  # "Packaged" logic
        source_prefix = source_path.rpartition(stack_path)[0]
        package_dir = stack_path.split("/")[0]
        return (f"{stack_root}{package_dir}/", f"{source_prefix}{package_dir}/")
    elif stack_path.endswith(source_path):
        stack_prefix = stack_path.rpartition(source_path)[0]
        return (f"{stack_root}{stack_prefix}", "")

    stack_path_delim = SLASH if SLASH in stack_path else BACKSLASH
    if stack_path_delim == BACKSLASH:
        stack_path = stack_path.replace(BACKSLASH, SLASH)
    if (straight_path_idx := get_straight_path_prefix_end_index(stack_path)) > 0:
        stack_root += stack_path[:straight_path_idx]
        stack_path = stack_path[straight_path_idx:]

    overlap_to_check: list[str] = stack_path.split(SLASH)
    stack_root_items: list[str] = []

    while overlap_to_check:
        if (overlap := SLASH.join(overlap_to_check)) and source_path.endswith(overlap):
            source_root = source_path.rpartition(overlap)[0]
            stack_root += stack_path_delim.join(stack_root_items)

            if stack_root and stack_root[-1] != stack_path_delim:  # append trailing slash
                stack_root = f"{stack_root}{stack_path_delim}"
            if source_root and source_root[-1] != SLASH:
                source_root = f"{source_root}{SLASH}"

            return (stack_root, source_root)

        # increase stack root specificity, decrease overlap specifity
        stack_root_items.append(overlap_to_check.pop(0))

    # validate_source_url should have ensured the file names match
    # so if we get here something went wrong and there is a bug
    raise UnexpectedPathException("Could not find common root from paths")
