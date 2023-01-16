from sentry.utils.safe import get_path


def has_proguard_file(data):
    """
    Checks whether an event contains a proguard file
    """
    images = get_path(data, "debug_meta", "images", filter=True)
    return get_path(images, 0, "type") == "proguard"
