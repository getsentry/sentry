from urllib.parse import urlparse


def parse_bitbucket_src_url(repo_url: str, source_url: str) -> tuple[str, str]:
    """
    Parse a Bitbucket src URL relative to a repository URL and return
    a tuple of (branch, source_path). If parsing fails, returns ("", "").
    """
    repo_path = urlparse(repo_url).path.rstrip("/")
    path = urlparse(source_url).path
    if repo_path and path.startswith(repo_path):
        path = path[len(repo_path) :]

    _, _, after_src = path.partition("/src/")
    if not after_src:
        return "", ""

    branch, _, remainder = after_src.partition("/")
    return branch, remainder.lstrip("/")
