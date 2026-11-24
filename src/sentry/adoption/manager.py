from collections import defaultdict
from collections.abc import Sequence
from typing import NamedTuple, cast

FEATURE_LOCATION = {"language", "integration", "code", "web", "admin", "api"}


class Feature(NamedTuple):
    id: int
    slug: str
    name: str
    location: str
    prerequisite: Sequence[str | tuple[str, ...]] | None


class UnknownFeature(KeyError):
    pass


class AdoptionManager:
    def __init__(self) -> None:
        self._id_registry: dict[int, Feature] = {}
        self._slug_registry: dict[str, Feature] = {}
        self._integration_slugs: defaultdict[str, set[str]] = defaultdict(set)
        self._location_slugs: defaultdict[str, set[str]] = defaultdict(set)
        self._slugs: set[str] = set()
        self._ids: set[int] = set()

    def add(
        self,
        id: int,
        slug: str,
        name: str,
        location: str,
        prerequisite: Sequence[str | tuple[str, ...]] | None = None,
    ) -> None:
        assert location in FEATURE_LOCATION

        feature = Feature(id, slug, name, location, prerequisite)
        self._id_registry[id] = feature
        self._slug_registry[slug] = feature
        self._slugs.add(slug)
        self._ids.add(id)
        self._location_slugs[location].add(slug)

        if location == "integration":
            assert prerequisite is not None
            self._integration_slugs[cast(str, prerequisite[0])].add(slug)

    def get_by_id(self, id: int) -> Feature:
        try:
            return self._id_registry[id]
        except KeyError:
            raise UnknownFeature(id)

    def get_by_slug(self, slug: str) -> Feature:
        try:
            return self._slug_registry[slug]
        except KeyError:
            raise UnknownFeature(slug)

    def all(self) -> list[Feature]:
        return [self._id_registry[k] for k in self._id_registry]

    def location_slugs(self, location: str) -> set[str]:
        return self._location_slugs[location]

    def integration_slugs(self, language: str) -> set[str]:
        return self._integration_slugs[language]
