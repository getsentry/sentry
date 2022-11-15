import logging
from typing import Dict, List, NamedTuple, Union

from .repo import Repo, RepoTree

logger = logging.getLogger("sentry.integrations.utils.code_mapping")
logger.setLevel(logging.INFO)


NO_TOP_DIR = "NO_TOP_DIR"


class CodeMapping(NamedTuple):
    repo: Repo
    stacktrace_root: str
    source_path: str


# XXX: Look at sentry.interfaces.stacktrace and maybe use that
class FrameFilename:
    def __init__(self, stacktrace_frame_file_path: str) -> None:
        self.full_path = stacktrace_frame_file_path
        if stacktrace_frame_file_path.find("/") > -1:
            # XXX: This code assumes that all stack trace frames are part of a module
            self.root, self.file_and_dir_path = stacktrace_frame_file_path.split("/", 1)

            # Check that it does have at least a dir
            if self.file_and_dir_path.find("/") > -1:
                self.dir_path, self.file_name = self.file_and_dir_path.rsplit("/", 1)
            else:
                # A package name, a file but no dir (e.g. requests/models.py)
                self.dir_path = ""
                self.file_name = self.file_and_dir_path
        else:
            self.root = ""
            self.dir_path = ""
            self.file_and_dir_path = self.full_path
            self.file_name = self.full_path

    def __repr__(self) -> str:
        return f"FrameFilename: {self.full_path}"

    def __eq__(self, other) -> bool:  # type: ignore
        return self.full_path == other.full_path  # type: ignore


class CodeMappingTreesHelper:
    def __init__(self, trees: Dict[str, RepoTree]):
        self.trees = trees
        self.code_mappings: Dict[str, CodeMapping] = {}

    def stacktrace_buckets(self, stacktraces: List[str]) -> Dict[str, List[FrameFilename]]:
        buckets: Dict[str, List[FrameFilename]] = {}
        for stacktrace_frame_file_path in stacktraces:
            try:
                frame_filename = FrameFilename(stacktrace_frame_file_path)
                # Any files without a top directory will be grouped together
                bucket_key = frame_filename.root if frame_filename.root else NO_TOP_DIR

                if not buckets.get(bucket_key):
                    buckets[bucket_key] = []
                buckets[bucket_key].append(frame_filename)

            except Exception:
                logger.exception("Unable to split stacktrace path into buckets")
                continue
        return buckets

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
        buckets: Dict[str, List[FrameFilename]] = self.stacktrace_buckets(stacktraces)

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
            except Exception:
                logger.exception(
                    f"Code mapping failed for {frame_filename} in {repo_full_name}. Processing continues."
                )

        if len(_code_mappings) == 0:
            logger.warning(f"No files matched for {frame_filename.full_path}")
            return None
        # This means that the file has been found in more than one repo
        elif len(_code_mappings) > 1:
            logger.warning(f"More than one repo matched {frame_filename.full_path}")
            return None

        return _code_mappings[0]

    def _get_code_mapping_source_path(self, src_file: str, frame_filename: FrameFilename) -> str:
        """Generate the source path of a code mapping
        e.g. src/sentry/identity/oauth2.py -> src/sentry
        e.g. ssl.py -> raise NotImplementedError
        """
        if frame_filename.dir_path != "":
            source_path = src_file.rsplit(frame_filename.dir_path)[0].rstrip("/")
            return f"{source_path}/"
        else:
            raise NotImplementedError("We do not support top level files.")

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
        # It is too risky generating code mappings when there's more
        # than one file potentially matching
        return (
            [
                CodeMapping(
                    repo=repo_tree.repo,
                    stacktrace_root=f"{frame_filename.root}/",  # sentry
                    source_path=self._get_code_mapping_source_path(
                        matched_files[0], frame_filename
                    ),
                )
            ]
            if len(matched_files) == 1
            else []
        )

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

    def _potential_match(self, src_file: str, frame_filename: FrameFilename) -> bool:
        """Tries to see if the stacktrace without the root matches the file from the
        source code. Use existing code mappings to exclude some source files
        """
        # Exit early because we should not be processing source files for existing code maps
        if self._matches_current_code_mappings(src_file, frame_filename):
            return False

        match = False
        # For instance:
        #  src_file: "src/sentry/integrations/slack/client.py"
        #  frame_filename.full_path: "sentry/integrations/slack/client.py"
        split = src_file.split(frame_filename.file_and_dir_path)
        if len(split) > 1:
            # This is important because we only want stack frames to match when they
            # include the exact package name
            # e.g. raven/base.py stackframe should not match this source file: apostello/views/base.py
            match = split[0].rfind(f"{frame_filename.root}/") > -1

        return match
