from typing import Any

from symbolic.sourcemap import SourceView

from sentry.utils.strings import codec_lookup

__all__ = ["SourceCache", "SourceMapCache"]


def is_utf8(codec: str) -> bool:
    name = codec_lookup(codec).name
    return name in ("utf-8", "ascii")


class SourceCache:
    def __init__(self) -> None:
        self._cache: dict[str, SourceView] = {}
        self._errors: dict[str, list[str]] = {}
        self._aliases: dict[str, str] = {}

    def __contains__(self, url: str) -> bool:
        url = self._get_canonical_url(url)
        return url in self._cache

    def _get_canonical_url(self, url: str) -> str:
        if url in self._aliases:
            url = self._aliases[url]
        return url

    def get(self, url: str) -> SourceView | None:
        return self._cache.get(self._get_canonical_url(url))

    def get_errors(self, url: str) -> list[str]:
        url = self._get_canonical_url(url)
        return self._errors.get(url, [])

    def alias(self, alias: str, target: str) -> None:
        if alias != target:
            self._aliases[alias] = target

    def add(self, url: str, source: SourceView | str | bytes, encoding: str | None = None) -> None:
        url = self._get_canonical_url(url)

        if not isinstance(source, SourceView):
            if isinstance(source, str):
                source = source.encode("utf-8")
            # If an encoding is provided and it's not utf-8 compatible
            # we try to re-encoding the source and create a source view
            # from it.
            elif encoding is not None and not is_utf8(encoding):
                try:
                    source = source.decode(encoding).encode("utf-8")
                except UnicodeError:
                    pass
            source = SourceView.from_bytes(source)
        self._cache[url] = source

    def add_error(self, url: str, error: str) -> None:
        url = self._get_canonical_url(url)
        self._errors.setdefault(url, [])
        self._errors[url].append(error)


class SourceMapCache:
    """
    Stores mappings between

        - the url of a file to be demangled and the url of its associated
          source map, and
        - a source map's url and the map's contents.
    """

    def __init__(self) -> None:
        self._cache: dict[str, Any] = {}
        self._mapping: dict[str, str] = {}

    def __contains__(self, sourcemap_url: str) -> bool:
        return sourcemap_url in self._cache

    def link(self, url: str, sourcemap_url: str) -> None:
        self._mapping[url] = sourcemap_url

    def add(self, sourcemap_url: str, sourcemap_view: Any) -> None:
        self._cache[sourcemap_url] = sourcemap_view

    def get(self, sourcemap_url: str) -> Any:
        return self._cache.get(sourcemap_url)

    def get_link(self, url: str) -> tuple[str | None, Any | None]:
        sourcemap_url = self._mapping.get(url)
        if sourcemap_url:
            sourcemap = self.get(sourcemap_url)
            return (sourcemap_url, sourcemap)
        return (None, None)
