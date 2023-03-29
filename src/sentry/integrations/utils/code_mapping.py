import logging
from typing import Dict, List, NamedTuple, Tuple, Union

from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.project import Project
from sentry.models.repository import Repository

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


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
    files: List[str]


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


def filter_source_code_files(files: List[str]) -> List[str]:
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


# XXX: Look at sentry.interfaces.stacktrace and maybe use that
class FrameFilename:
    def __init__(self, frame_file_path: str) -> None:
        # Using regexes would be better but this is easier to understand
        if (
            not frame_file_path
            or frame_file_path[0] in ["[", "<", "/"]
            or frame_file_path.find(" ") > -1
            or frame_file_path.find("\\") > -1  # Windows support
            or frame_file_path.find("/") == -1
        ):
            raise UnsupportedFrameFilename("Either garbage or will need work to support.")

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
        backslash_index = frame_file_path.find("/", start_at_index)
        dir_path, self.file_name = frame_file_path.rsplit("/", 1)  # foo.tsx (both)
        self.root = frame_file_path[0:backslash_index]  # some or .some
        self.dir_path = dir_path.replace(self.root, "")  # some/path/ (both)
        self.file_and_dir_path = remove_straight_path_prefix(
            frame_file_path
        )  # some/path/foo.tsx (both)

    def __repr__(self) -> str:
        return f"FrameFilename: {self.full_path}"

    def __eq__(self, other) -> bool:  # type: ignore
        return self.full_path == other.full_path  # type: ignore


def stacktrace_buckets(stacktraces: List[str]) -> Dict[str, List[FrameFilename]]:
    buckets: Dict[str, List[FrameFilename]] = {}
    for stacktrace_frame_file_path in stacktraces:
        try:
            frame_filename = FrameFilename(stacktrace_frame_file_path)
            # Any files without a top directory will be grouped together
            bucket_key = frame_filename.root

            if not buckets.get(bucket_key):
                buckets[bucket_key] = []
            buckets[bucket_key].append(frame_filename)

        except UnsupportedFrameFilename:
            logger.info(
                "Frame's filepath not supported.",
                extra={"frame_file_path": stacktrace_frame_file_path},
            )
        except Exception:
            logger.exception("Unable to split stacktrace path into buckets")

    return buckets


# call generate_code_mappings() after you initialize CodeMappingTreesHelper
class CodeMappingTreesHelper:
    def __init__(self, trees: Dict[str, RepoTree]):
        self.trees = trees
        self.code_mappings: Dict[str, CodeMapping] = {}

    def process_stackframes(self, buckets: Dict[str, List[FrameFilename]]) -> bool:
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

    def generate_code_mappings(self, stacktraces: List[str]) -> List[CodeMapping]:
        """Generate code mappings based on the initial trees object and the list of stack traces"""
        # We need to make sure that calling this method with a new list of stack traces
        # should always start with a clean slate
        self.code_mappings = {}
        buckets: Dict[str, List[FrameFilename]] = stacktrace_buckets(stacktraces)

        # We reprocess stackframes until we are told that no code mappings were produced
        # This is order to reprocess past stackframes in light of newly discovered code mappings
        # This allows for idempotency since the order of the stackframes will not matter
        # This has no performance issue because stackframes that match an existing code mapping
        # will be skipped
        while True:
            if not self.process_stackframes(buckets):
                break

        return list(self.code_mappings.values())

    def _find_code_mapping(self, frame_filename: FrameFilename) -> Union[CodeMapping, None]:
        """Look for the file path through all the trees and generate code mappings for it"""
        _code_mappings: List[CodeMapping] = []
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
            logger.warning(f"No files matched for {frame_filename.full_path}")
            return None
        # This means that the file has been found in more than one repo
        elif len(_code_mappings) > 1:
            logger.warning(f"More than one repo matched {frame_filename.full_path}")
            return None

        return _code_mappings[0]

    def list_file_matches(self, frame_filename: FrameFilename) -> List[Dict[str, str]]:
        file_matches = []
        for repo_full_name in self.trees.keys():
            repo_tree = self.trees[repo_full_name]
            matches = [
                src_path
                for src_path in repo_tree.files
                if self._potential_match(src_path, frame_filename)
            ]

            for file in matches:
                file_matches.append(
                    {
                        "filename": file,
                        "repo_name": repo_tree.repo.name,
                        "repo_branch": repo_tree.repo.branch,
                        "stacktrace_root": f"{frame_filename.root}/",
                        "source_path": self._get_code_mapping_source_path(file, frame_filename),
                    }
                )
        return file_matches

    def _get_code_mapping_source_path(self, src_file: str, frame_filename: FrameFilename) -> str:
        """Generate the source code root for a code mapping. It always includes a last backslash"""
        source_code_root = None
        if frame_filename.frame_type() == "packaged":
            if frame_filename.dir_path != "":
                # src/sentry/identity/oauth2.py (sentry/identity/oauth2.py) -> src/sentry/
                source_path = src_file.rsplit(frame_filename.dir_path)[0].rstrip("/")
                source_code_root = f"{source_path}/"
            elif frame_filename.root != "":
                # src/sentry/wsgi.py (sentry/wsgi.py) -> src/sentry/
                source_code_root = src_file.rsplit(frame_filename.file_name)[0]
            else:
                # ssl.py -> raise NotImplementedError
                raise NotImplementedError("We do not support top level files.")
        else:
            # static/app/foo.tsx (./app/foo.tsx) -> static/app/
            # static/app/foo.tsx (app/foo.tsx) -> static/app/
            source_code_root = f"{src_file.replace(frame_filename.file_and_dir_path, remove_straight_path_prefix(frame_filename.root))}/"
        if source_code_root:
            assert source_code_root.endswith("/")
        return source_code_root

    def _normalized_stack_and_source_roots(
        self, stacktrace_root: str, source_path: str
    ) -> Tuple[str, str]:
        # We have a one to one code mapping (e.g. "app/" & "app/")
        if source_path == stacktrace_root:
            stacktrace_root = ""
            source_path = ""
        # stacktrace_root starts with a FILE_PATH_PREFIX_REGEX
        elif (without := remove_straight_path_prefix(stacktrace_root)) != stacktrace_root:
            start_index = get_straight_path_prefix_end_index(stacktrace_root)
            starts_with = stacktrace_root[:start_index]
            if source_path == without:
                stacktrace_root = starts_with
                source_path = ""
            elif source_path.rfind(f"/{without}"):
                stacktrace_root = starts_with
                source_path = source_path.replace(f"/{without}", "/")
        return (stacktrace_root, source_path)

    def _generate_code_mapping_from_tree(
        self,
        repo_tree: RepoTree,
        frame_filename: FrameFilename,
    ) -> List[CodeMapping]:
        matched_files = [
            src_path
            for src_path in repo_tree.files
            if self._potential_match(src_path, frame_filename)
        ]
        if len(matched_files) != 1:
            return []

        stacktrace_root = f"{frame_filename.root}/"
        source_path = self._get_code_mapping_source_path(matched_files[0], frame_filename)
        if frame_filename.frame_type() != "packaged":
            stacktrace_root, source_path = self._normalized_stack_and_source_roots(
                stacktrace_root, source_path
            )
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
    organization_integration: OrganizationIntegration, project: Project, code_mapping: CodeMapping
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
            "organization_integration_id": organization_integration.id,
            "source_root": code_mapping.source_path,
            "default_branch": code_mapping.repo.branch,
            "automatically_generated": True,
        },
    )

    if created:
        logger.info(
            f"Created a code mapping for {project.slug=}, stack root: {code_mapping.stacktrace_root}"
        )
    else:
        logger.info(
            f"Updated existing code mapping for {project.slug=}, stack root: {code_mapping.stacktrace_root}"
        )

    return new_code_mapping
