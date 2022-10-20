import logging
from typing import Any, Dict, List

logger = logging.getLogger("sentry.integrations.utils.code_mapping")
logger.setLevel(logging.INFO)


def derive_code_mappings(stacktraces: List[str], trees: Dict[str, Any]):
    """From a list of stack trace frames for a project and the trees for an org,
    generate the code mappings for it.

    WARNING: Do not pass stacktraces from different projects or the wrong code mappings will be returned.
    """
    trees_helper = CodeMappingTreesHelper(trees)
    code_mappings = trees_helper.generate_code_mappings(stacktraces)
    return code_mappings


class StacktraceFrameInfo:
    def __init__(self, stacktrace_frame_file_path):
        self._breakdown_stacktrace_frame_file_path(stacktrace_frame_file_path)

    def _breakdown_stacktrace_frame_file_path(self, stacktrace_frame_file_path: str) -> None:
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

    def __repr__(self):
        return self.full_path


class CodeMappingTreesHelper:
    def __init__(self, trees: Dict[str, Any]):
        self.trees = trees
        self.code_mappings: Dict[str, Any] = {}
        # This simplifies excluding source files for existing code mappings
        self.reverse_mapping: List[str] = []

    def generate_code_mappings(self, stacktraces: List[str]) -> Dict[str, Any]:
        # XXX: Rewind feature
        # XXX: Turn stacktraces into buckets
        buckets: Dict[str, Any] = {}
        for stacktrace_frame_file_path in stacktraces:
            try:
                frame_info = StacktraceFrameInfo(stacktrace_frame_file_path)
                if not frame_info.get(frame_info.root):
                    frame_info[frame_info.root] = [frame_info]
                else:
                    frame_info[frame_info.root] += frame_info
            except ValueError:
                logger.exception(
                    f"We cannot breakdown this stacktrace path: {stacktrace_frame_file_path}"
                )
                continue

        for stackframe_root, stackframes in buckets.items():
            if not self.code_mappings.get(stackframe_root):
                code_mapping = self._find_code_mapping(frame_info)
                if code_mapping:
                    self.code_mappings[frame_info.root] = code_mapping

    def _find_code_mapping(self, frame_info: Any) -> List[Dict[str, Any]]:
        """Look for the file path through all the trees and generate a code mapping for it"""
        _code_mappings = []
        # XXX: This may need optimization by changing the data structure of the trees
        for repo_full_name, tree in self.trees.items():
            _code_mappings += self._generate_code_mapping_from_tree(repo_full_name, frame_info)

        if len(_code_mappings) == 0:
            logger.warning(f"No files matched for {frame_info.full_path}")
            return []
        # This means that the file has been found in more than one repo
        elif len(_code_mappings) > 1:
            print(_code_mappings)
            import pdb

            pdb.set_trace()
            logger.warning(f"More than one file matched for {frame_info.full_path}")
            return []
        # XXX: Update self.code_mappings here??
        return _code_mappings[0]

    def _generate_code_mapping_from_tree(
        self,
        repo_full_name: str,
        frame_info: Any,
    ) -> Dict[str, Any]:
        # def code_mapping_from_file_path(src_path: str):

        # repo_code_mapping: Dict[str, Any] = {}
        matched_files = list(
            filter(
                lambda src_path: self._potential_match(src_path, frame_info),
                self.trees[repo_full_name],
            )
        )
        # It is too risky trying to generate code mappings when there's more
        # than one file potentially matching
        if len(matched_files) == 1:
            return {
                "repo": repo_full_name,
                "stacktrace_root": frame_info.root,  # sentry
                # src/sentry/identity/oauth2.py -> src/sentry
                "src_path": matched_files[0].rsplit(frame_info.dir_path)[0].rstrip("/"),
            }
            # code_mappings += list(
            #     map(
            #         lambda src_path: code_mapping_from_file_path(src_path),
            #         matched_files,
            #     )
            # )
            #  XXX: Fix this
        # return repo_code_mapping

    def _potential_match(self, src_file: str, frame_info: Any):
        """Tries to see if the stacktrace without the root matches the file from the
        source code. Use reverse code mappings to exclude some source files
        """
        if self.reverse_mapping:
            # In some cases, once we have derived a code mapping we can exclude files that start with
            # that source path.
            #
            # For instance sentry_plugins/slack/client.py matches these files
            # - "src/sentry_plugins/slack/client.py",
            # - "src/sentry/integrations/slack/client.py",
            matches_code_path = list(
                filter(
                    # XXX: We should make sure that we're consistent wrt to src_path
                    # to be store with a forward slash or not
                    lambda src_path: src_file.startswith(f"{src_path}/"),
                    self.reverse_mapping,
                )
            )
            if len(matches_code_path) > 0:
                return False
        # It has to have at least one directory with
        # e.g. requests/models.py matches all files with models.py
        if frame_info.file_and_dir_path.find("/") > -1:
            return src_file.rfind(frame_info.file_and_dir_path) > -1
