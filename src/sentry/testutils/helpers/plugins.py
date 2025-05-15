import importlib.metadata


def _get_ep(group: str, name: str) -> importlib.metadata.EntryPoint | None:
    for ep in importlib.metadata.distribution("sentry").entry_points:
        if ep.group == group and ep.name == name:
            return ep
    else:
        return None


def assert_plugin_installed(name: str, plugin: object) -> None:
    path = type(plugin).__module__ + ":" + type(plugin).__name__
    ep = _get_ep("sentry.plugins", name)
    assert ep is not None and ep.value == path


def assert_app_installed(name: str, path: str) -> None:
    ep = _get_ep("sentry.apps", name)
    assert ep is not None and ep.value == path
