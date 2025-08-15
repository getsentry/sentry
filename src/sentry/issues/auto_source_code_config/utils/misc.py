# List of file paths prefixes that should become stack trace roots
FILE_PATH_PREFIX_LENGTH = {
    "app:///": 7,
    "../": 3,
    "./": 2,
}


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
