import re

# Absolute paths where iOS mounts application files.
IOS_APP_PATHS = (
    "/var/containers/Bundle/Application/",
    "/private/var/containers/Bundle/Application/",
)

# Locations which usually contain MacOS apps.
MACOS_APP_PATHS = (".app/Contents/", "/Users/", "/usr/local/")

# Paths which usually contain linux system or third party libraries.
LINUX_SYS_PATHS = ("/lib/", "/usr/lib/", "linux-gate.so")

# Regex matching the Windows folder on any drive.
WINDOWS_SYS_PATH_RE = re.compile(r"^[a-z]:\\windows", re.IGNORECASE)

# Regex matching well-known iOS and macOS frameworks (and our own).
SUPPORT_FRAMEWORK_RE = re.compile(
    r"""(?x)
    /Frameworks/(
            libswift([a-zA-Z0-9]+)\.dylib$
        |   (KSCrash|SentrySwift|Sentry)\.framework/
    )
    """
)


def _is_support_framework(package):
    return SUPPORT_FRAMEWORK_RE.search(package) is not None


# TODO(ja): Translate these rules to grouping enhancers
def is_known_third_party(package, sdk_info=None):
    """
    Checks whether this package matches one of the well-known system image
    locations across platforms. The given package must not be ``None``.
    """

    # Check for common iOS and MacOS support frameworks, like Swift.
    if _is_support_framework(package):
        return True

    # Check for iOS app bundles in well known locations. These are definitely
    # not third-party, as they contain the application.
    if package.startswith(IOS_APP_PATHS):
        return False

    # Check for app locations in the iOS simulator
    if (
        "/Developer/CoreSimulator/Devices/" in package
        and "/Containers/Bundle/Application/" in package
    ):
        return False

    # Check for OS-specific rules
    sdk_name = sdk_info["sdk_name"].lower() if sdk_info else ""
    if sdk_name == "macos":
        return not any(p in package for p in MACOS_APP_PATHS)
    if sdk_name == "linux":
        return package.startswith(LINUX_SYS_PATHS)
    if sdk_name == "windows":
        return WINDOWS_SYS_PATH_RE.match(package) is not None

    # Everything else we don't know is considered third_party
    return True


# TODO(ja): Improve reprocessing heuristics
def is_optional_package(package, sdk_info=None):
    """
    Determines whether the given package is considered optional.

    This indicates that no error should be emitted if this package is missing
    during symbolication. Also, reprocessing should not block for this image.
    """

    if not package:
        return True

    # Support frameworks have been bundled with iOS apps at times. These are
    # considered optional.
    if _is_support_framework(package):
        return True

    # Bundled frameworks on iOS are considered optional, even though they live
    # in the application folder. They are not considered third party, however.
    if package.startswith(IOS_APP_PATHS) and "/Frameworks/" in package:
        return True

    # All other images, whether from the app bundle or not, are considered
    # required.
    return False
