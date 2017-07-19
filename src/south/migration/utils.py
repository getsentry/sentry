import sys
from collections import deque

from django.utils.datastructures import SortedDict
from django.db import models

from south import exceptions


class SortedSet(SortedDict):
    def __init__(self, data=tuple()):
        self.extend(data)

    def __str__(self):
        return "SortedSet(%s)" % list(self)

    def add(self, value):
        self[value] = True

    def remove(self, value):
        del self[value]

    def extend(self, iterable):
        [self.add(k) for k in iterable]


def get_app_label(app):
    """
    Returns the _internal_ app label for the given app module.
    i.e. for <module django.contrib.auth.models> will return 'auth'
    """
    return app.__name__.split('.')[-2]


def app_label_to_app_module(app_label):
    """
    Given the app label, returns the module of the app itself (unlike models.get_app,
    which returns the models module)
    """
    # Get the models module
    app = models.get_app(app_label)
    module_name = ".".join(app.__name__.split(".")[:-1])
    try:
        module = sys.modules[module_name]
    except KeyError:
        __import__(module_name, {}, {}, [''])
        module = sys.modules[module_name]
    return module


def flatten(*stack):
    stack = deque(stack)
    while stack:
        try:
            x = next(stack[0])
        except TypeError:
            stack[0] = iter(stack[0])
            x = next(stack[0])
        except StopIteration:
            stack.popleft()
            continue
        if hasattr(x, '__iter__') and not isinstance(x, str):
            stack.appendleft(x)
        else:
            yield x

dependency_cache = {}

def _dfs(start, get_children, path):
    if (start, get_children) in dependency_cache:
        return dependency_cache[(start, get_children)]

    results = []
    if start in path:
        raise exceptions.CircularDependency(path[path.index(start):] + [start])
    path.append(start)
    results.append(start)
    children = sorted(get_children(start), key=lambda x: str(x))
    
    # We need to apply all the migrations this one depends on
    for n in children:
        results = _dfs(n, get_children, path) + results

    path.pop()

    results = list(SortedSet(results))
    dependency_cache[(start, get_children)] = results
    return results

def dfs(start, get_children):
    return _dfs(start, get_children, [])

def depends(start, get_children):
    return dfs(start, get_children)
