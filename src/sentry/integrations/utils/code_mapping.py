import logging
from typing import Any, Dict, List, Union

logger = logging.getLogger("sentry.integrations.utils.code_mapping")
logger.setLevel(logging.INFO)


# XXX: Deal with the branch later
class CodeMapping:
    def __init__(self, repo: str, stacktrace_root: str, source_path: str):
        self.repo = repo
        self.stacktrace_root = stacktrace_root
        self.source_path = source_path

    def __repr__(self) -> str:
        return f"{self.repo}: {self.stacktrace_root}->{self.source_path}"

    def __cmp__(self, other):
        return (
            0
            if (
                self.repo == other.repo
                and self.stacktrace_root == other.stacktrace_root
                and self.source_path == other.source_path
            )
            else -1
        )


def derive_code_mappings(stacktraces: List[str], trees: Dict[str, Any]) -> List[CodeMapping]:
    """From a list of stack trace frames for a project and the trees for an org,
    generate the code mappings for it.

    WARNING: Do not pass stacktraces from different projects or the wrong code mappings will be returned.
    """
    trees_helper = CodeMappingTreesHelper(trees)
    code_mappings = trees_helper.generate_code_mappings(stacktraces)
    return code_mappings


# XXX: Look at sentry.interfaces.stacktrace and use that
class FrameFilename:
    def __init__(self, stacktrace_frame_file_path: str) -> None:
        self.full_path = stacktrace_frame_file_path
        # XXX: This code assumes that all stack trace frames are part of a module
        split = stacktrace_frame_file_path.split("/", 1)
        self.root = split[0]
        self.file_and_dir_path = split[1]
        # Does it have more than one level?
        if self.file_and_dir_path.find("/") > -1:
            split = self.file_and_dir_path.rsplit("/", 1)
            self.dir_path = split[0]
            self.file_name = split[-1]
        else:
            # A package name + a file (e.g. requests/models.py)
            self.dir_path = ""
            self.file_name = self.file_and_dir_path

    def __repr__(self) -> str:
        return self.full_path


class CodeMappingTreesHelper:
    def __init__(self, trees: Dict[str, Any]):
        self.trees = trees
        self.code_mappings: Dict[str, Any] = {}
        # This simplifies excluding source files for existing code mappings
        self.reverse_mapping: List[str] = []

    def stacktrace_buckets(self, stacktraces: List[str]) -> Dict[str, Any]:
        buckets: Dict[str, Any] = {}
        for stacktrace_frame_file_path in stacktraces:
            try:
                frame_filename = FrameFilename(stacktrace_frame_file_path)
                if frame_filename:
                    if frame_filename.root:
                        buckets[frame_filename.root] = [frame_filename]
                    else:
                        buckets[frame_filename.root] += frame_filename
                else:
                    logger.warning(
                        f"We cannot breakdown this stacktrace path: {stacktrace_frame_file_path}"
                    )
            except ValueError:
                logger.exception(
                    f"We cannot breakdown this stacktrace path: {stacktrace_frame_file_path}"
                )
                continue
        return buckets

    def generate_code_mappings(self, stacktraces: List[str]) -> List[CodeMapping]:
        """Generate code mappings based on the initial trees object and the list of stack traces"""
        # We need to make sure that calling this method with a new list of stack traces should always
        # start with a clean slate
        self.code_mappings = {}
        # XXX: Rewind feature
        buckets: Dict[str, Any] = self.stacktrace_buckets(stacktraces)

        for stackframe_root, stackframes in buckets.items():
            if not self.code_mappings.get(stackframe_root):
                for frame_filename in stackframes:
                    code_mapping = self._find_code_mapping(frame_filename)
                    if code_mapping:
                        self.code_mappings[stackframe_root] = code_mapping

        return list(self.code_mappings.values())

    def _find_code_mapping(self, frame_filename: FrameFilename) -> Union[CodeMapping, None]:
        """Look for the file path through all the trees and generate code mappings for it"""
        _code_mappings: List[CodeMapping] = []
        # XXX: This will need optimization by changing the data structure of the trees
        for repo_full_name, tree in self.trees.items():
            _code_mappings.extend(
                self._generate_code_mapping_from_tree(repo_full_name, frame_filename)
            )

        if len(_code_mappings) == 0:
            logger.warning(f"No files matched for {frame_filename.full_path}")
            return None
        # This means that the file has been found in more than one repo
        elif len(_code_mappings) > 1:
            logger.warning(f"More than one file matched for {frame_filename.full_path}")
            return None

        return _code_mappings[0]

    def _generate_code_mapping_from_tree(
        self,
        repo_full_name: str,
        frame_filename: FrameFilename,
    ) -> List[CodeMapping]:
        matched_files = list(
            filter(
                lambda src_path: self._potential_match(src_path, frame_filename),
                self.trees[repo_full_name],
            )
        )
        # It is too risky trying to generate code mappings when there's more
        # than one file potentially matching
        return (
            [
                CodeMapping(
                    repo=repo_full_name,
                    stacktrace_root=frame_filename.root,  # sentry
                    # e.g. src/sentry/identity/oauth2.py -> src/sentry
                    source_path=matched_files[0].rsplit(frame_filename.dir_path)[0].rstrip("/"),
                )
            ]
            if len(matched_files) == 1
            else []
        )

    def _matches_current_code_mappings(self, src_file: str, frame_filename: FrameFilename) -> bool:
        if not self.reverse_mapping:
            return False
        else:
            # In some cases, once we have derived a code mapping we can exclude files that start with
            # that source path.
            #
            # For instance sentry_plugins/slack/client.py matches these files
            # - "src/sentry_plugins/slack/client.py",
            # - "src/sentry/integrations/slack/client.py",
            return (
                True
                if len(
                    list(
                        filter(
                            # XXX: We should make sure that we're consistent wrt to src_path
                            # to be store with a forward slash or not
                            lambda source_path: src_file.startswith(f"{source_path}/"),
                            self.reverse_mapping,
                        )
                    )
                )
                > 0
                else False
            )

    def _potential_match(self, src_file: str, frame_filename: FrameFilename) -> bool:
        """Tries to see if the stacktrace without the root matches the file from the
        source code. Use reverse code mappings to exclude some source files
        """
        if self._matches_current_code_mappings(src_file, frame_filename):
            # Exit early because we should not be processing this filename
            # since we have an existing code mapping
            return False

        ret_value = False
        # It has to have at least one directory with
        # e.g. requests/models.py matches all files with models.py
        if frame_filename.file_and_dir_path.find("/") > -1:
            ret_value = src_file.rfind(frame_filename.file_and_dir_path) > -1

        return ret_value
