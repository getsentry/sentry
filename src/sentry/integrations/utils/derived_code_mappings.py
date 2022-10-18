from typing import Any, Dict

CODE_MAPPINGS: Dict[str, Any] = {}


def breakdown_stacktrace_frame_file_path(stacktrace_frame_file_path: str):
    stacktrace_root, file_and_dir_path = stacktrace_frame_file_path.split("/", 1)
    if file_and_dir_path.find("/") > -1:
        dir_path, file_name = file_and_dir_path.rsplit("/", 1)
    else:
        # e.g. requests/models.py
        dir_path, file_name = "", file_and_dir_path
    return (stacktrace_root, file_and_dir_path, dir_path, file_name)


def potential_match(src_file: str, stacktrace_no_root: str):
    """Tries to see if the stacktrace without the root matches the file from the source code"""
    # In some cases, once we have derived a code mapping we can exclude files that start with
    # that source path.
    # For instance sentry_plugins/slack/client.py matches these files
    # - "src/sentry_plugins/slack/client.py",
    # - "src/sentry/integrations/slack/client.py",
    matches_code_path = list(
        filter(
            lambda code_mapping: src_file.startswith(f"{code_mapping['src_path']}/"),
            CODE_MAPPINGS.values(),
        )
    )
    if len(matches_code_path) > 0:
        return False
    # It has to have at least one directory with
    # e.g. requests/models.py matches all files with models.py
    if stacktrace_no_root.find("/") > -1:
        return src_file.rfind(stacktrace_no_root) > -1


def find_code_mapping(stacktrace_frame_file_path: str, trees: Dict[str, Any]):
    try:
        (
            stacktrace_root,
            file_and_dir_path,
            dir_path,
            file_name,
        ) = breakdown_stacktrace_frame_file_path(stacktrace_frame_file_path)
    except ValueError:
        # print(f"We cannot breakdown this stacktrace path: {stacktrace_frame_file_path}")
        return

    def code_mapping_from_file_path(file_path: str):
        return {
            "repo": repo_full_name,
            "stacktrace_root": stacktrace_root,
            "src_path": file_path.rsplit(dir_path)[0].rstrip("/"),
        }

    code_mappings = []
    for repo_full_name, tree in trees.items():
        matched_files = list(
            filter(
                lambda file_path: potential_match(file_path, file_and_dir_path),
                tree,
            )
        )
        # It is too risky trying to generate code mappings when there's more than one file
        # potentially matching
        if len(matched_files) == 1:
            code_mappings += list(
                map(
                    lambda x: code_mapping_from_file_path(x),
                    matched_files,
                )
            )

    if len(code_mappings) == 0:
        # print(f"No files matched for {stacktrace_frame_file_path}")
        return None
    # This means that the file has been found in more than one repo
    elif len(code_mappings) > 1:
        # print(f"More than one file matched for {stacktrace_frame_file_path}")
        return None
    return code_mappings[0]


def derive_code_mappings(stacktraces, trees):
    """From a list of stack trace frames, produce the code mappings for it"""
    for line in stacktraces:
        stacktrace_root = line.split("/", 1)[0]
        # Once we store a code mapping in this dictionary, we don't need to search anymore
        if not CODE_MAPPINGS.get(stacktrace_root):
            code_mapping = find_code_mapping(line, trees)
            if code_mapping:
                CODE_MAPPINGS[stacktrace_root] = code_mapping

    return CODE_MAPPINGS
