from urllib.parse import urlparse


# TODO: implement and workshop name
def check_origin(referrer: str | None, allowed_origins: list[str]) -> bool:
    if not referrer:
        return False

    urlparse(referrer)
    for origin in allowed_origins:
        urlparse(origin)
    return True
