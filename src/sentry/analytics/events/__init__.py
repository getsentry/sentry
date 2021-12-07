from sentry.utils.imports import import_submodules

path = __path__  # type: ignore
import_submodules(globals(), __name__, path)
