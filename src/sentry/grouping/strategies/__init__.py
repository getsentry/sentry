from __future__ import absolute_import


def _import_all():
    import pkgutil
    for _, module, _ in pkgutil.iter_modules(__path__):
        if module == 'configurations':
            continue
        __import__('%s.%s' % (__name__, module))

    # import these last
    __import__('%s.configurations' % __name__)


_import_all()
del _import_all
