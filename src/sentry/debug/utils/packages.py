import importlib.metadata
import sys


def get_package_version(module_name: str, app: object) -> str | None:
    version: object = None

    # Try to pull version from importlib.metadata first
    # as it is able to detect version tagged with egg_info -b
    try:
        return importlib.metadata.version(module_name)
    except Exception:
        pass

    for attr in ("get_version", "__version__", "VERSION", "version"):
        if hasattr(app, attr):
            version = getattr(app, attr)
            break

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


def get_all_package_versions() -> dict[str, str]:
    packages = {}
    for module_name, app in sys.modules.copy().items():
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
