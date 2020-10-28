from __future__ import absolute_import

from collections import defaultdict, namedtuple

FEATURE_LOCATION = {"language", "integration", "code", "web", "admin", "api"}

Feature = namedtuple("Feature", ["id", "slug", "name", "location", "prerequisite"])


class UnknownFeature(KeyError):
    pass


class AdoptionManager(object):
    def __init__(self):
        self._id_registry = {}
        self._slug_registry = {}
        self._integration_slugs = defaultdict(set)
        self._location_slugs = defaultdict(set)
        self._slugs = set()
        self._ids = set()

    def add(self, id, slug, name, location, prerequisite=None):
        assert location in FEATURE_LOCATION

        feature = Feature(id, slug, name, location, prerequisite)
        self._id_registry[id] = feature
        self._slug_registry[slug] = feature
        self._slugs.add(slug)
        self._ids.add(id)
        self._location_slugs[location].add(slug)

        if location == "integration":
            self._integration_slugs[prerequisite[0]].add(slug)

    def get_by_id(self, id):
        try:
            return self._id_registry[id]
        except KeyError:
            raise UnknownFeature(id)

    def get_by_slug(self, slug):
        try:
            return self._slug_registry[slug]
        except KeyError:
            raise UnknownFeature(slug)

    def all(self):
        return [self._id_registry[k] for k in self._id_registry]

    def location_slugs(self, location):
        return self._location_slugs[location]

    def integration_slugs(self, language):
        return self._integration_slugs[language]
