from urllib.parse import urlparse


# TODO: implement and workshop name
def check_origin(referrer: str | None, allowed_origins: list[str]) -> bool:
    if referrer:
        urlparse(referrer)
        for origin in allowed_origins:
            urlparse(origin)

    return False
