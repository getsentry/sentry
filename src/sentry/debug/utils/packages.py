import sys

from sentry.utils.compat import map

try:
    import pkg_resources
except ImportError:
    pkg_resources = None  # NOQA


def get_package_version(module_name, app):
    version = None

    # Try to pull version from pkg_resource first
    # as it is able to detect version tagged with egg_info -b
    if pkg_resources is not None:
        # pull version from pkg_resources if distro exists
        try:
            return pkg_resources.get_distribution(module_name).version
        except Exception:
            pass

    if hasattr(app, "get_version"):
        version = app.get_version
    elif hasattr(app, "__version__"):
        version = app.__version__
    elif hasattr(app, "VERSION"):
        version = app.VERSION
    elif hasattr(app, "version"):
        version = app.version

    if callable(version):
        try:
            version = version()
        except Exception:
            return None

    if not isinstance(version, (str,) + (list, tuple)):
        version = None

    if version is None:
        return None

    if isinstance(version, (list, tuple)):
        version = ".".join(map(str, version))

    return str(version)


def get_all_package_versions():
    packages = {}
    for module_name, app in sys.modules.items():
        # ignore items that look like submodules
        if "." in module_name:
            continue

        if "sys" == module_name:
            continue

        version = get_package_version(module_name, app)

        if version is None:
            continue

        packages[module_name] = version

    packages["sys"] = "{}.{}.{}".format(*sys.version_info)

    return packages
