import re

from sentry.utils.safe import get_path

SOURCE_MAPPING_URL_RE = re.compile(b"//# sourceMappingURL=(.*)$")


def has_sourcemap(event):
    if event.platform not in ("javascript", "node"):
        return False

    for exception in get_path(event.data, "exception", "values", filter=True, default=()):
        for frame in get_path(exception, "stacktrace", "frames", filter=True, default=()):
            if "sourcemap" in (frame.get("data") or ()):
                return True

    return False


def find_sourcemap(sourcemap_header, body):
    sourcemap_url = sourcemap_header
    if not sourcemap_header:
        parsed_body = body.split(b"\n")
        # Source maps are only going to exist at either the top or bottom of the document.
        # Technically, there isn't anything indicating *where* it should exist, so we
        # are generous and assume it's somewhere either in the first or last 5 lines.
        # If it's somewhere else in the document, you're probably doing it wrong.
        if len(parsed_body) > 10:
            possibilities = parsed_body[:5] + parsed_body[-5:]
        else:
            possibilities = parsed_body

        # We want to scan each line sequentially, and the last one found wins
        # This behavior is undocumented, but matches what Chrome and Firefox do.
        for line in possibilities:
            if line[:21] in (b"//# sourceMappingURL=", b"//@ sourceMappingURL="):
                # We want everything AFTER the indicator, which is 21 chars long
                sourcemap_url = line[21:].rstrip()

        # If we still haven't found anything, check end of last line AFTER source code.
        # This is not the literal interpretation of the spec, but browsers support it.
        # e.g. {code}//# sourceMappingURL={url}
        if not sourcemap_url:
            # Only look at last 300 characters to keep search space reasonable (minified
            # JS on a single line could be tens of thousands of chars). This is a totally
            # arbitrary number / best guess; most sourceMappingURLs are relative and
            # not very long.
            search_space = possibilities[-1][-300:].rstrip()
            match = SOURCE_MAPPING_URL_RE.search(search_space)
            if match:
                sourcemap_url = match.group(1)

    if sourcemap_url:
        # react-native shoves a comment at the end of the
        # sourceMappingURL line.
        # For example:
        #  sourceMappingURL=app.js.map/*ascii:...*/
        # This comment is completely out of spec and no browser
        # would support this, but we need to strip it to make
        # people happy.
        if b"/*" in sourcemap_url and sourcemap_url[-2:] == b"*/":
            index = sourcemap_url.index(b"/*")
            # comment definitely shouldn't be the first character,
            # so let's just make sure of that.
            if index == 0:
                raise AssertionError(
                    "react-native comment found at bad location: %d, %r" % (index, sourcemap_url)
                )
            sourcemap_url = sourcemap_url[:index]
    return sourcemap_url
