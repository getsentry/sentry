from typing import Optional
from warnings import warn

from sentry.utils.safe import get_path
from sentry.utils.strings import strip, truncatechars

# Note: Detecting eventtypes is implemented in the Relay Rust library.


def get_tree_label_part_details(part):
    """
    Get the label for a tree part.

    :param dict part: The tree part to get the label for.
    :returns str: The label of the given ``part`` or ``<unknown>``
    if no valid key is found in it.
    """
    # Note: This function also exists in JS in app/utils/events.tsx, to make
    # porting efforts simpler it's recommended to keep both variants structurally
    # similar.
    if isinstance(part, str):
        # XXX(markus): Legacy codepath, should be unnecessary 90d after
        # 2021-06-09. Same for frontend version.
        return part

    label = part.get("function") or part.get("package") or part.get("filebase") or part.get("type")

    classbase = part.get("classbase")

    if classbase:
        if label:
            label = f"{classbase}.{label}"
        else:
            label = classbase

    return label or "<unknown>"


def format_title_from_tree_label(tree_label):
    return " | ".join(get_tree_label_part_details(x) for x in tree_label)


def compute_title_with_tree_label(title: Optional[str], metadata: dict):
    tree_label = None
    if metadata.get("current_tree_label"):
        tree_label = format_title_from_tree_label(metadata["current_tree_label"])

    elif metadata.get("finest_tree_label"):
        tree_label = format_title_from_tree_label(metadata["finest_tree_label"])

    if title is None:
        # Probably a synthetic exception
        return tree_label or metadata.get("function") or "<unknown>"

    if tree_label is not None:
        title += " | " + tree_label

    return title


class BaseEvent:
    id = None

    def get_metadata(self, data):
        """
        Extract metadata from a file.

        :param data: The contents of the file.
        :returns: A dictionary containing extracted metadata, or ``None`` if no metadata
        was found in the file.
        """
        metadata = self.extract_metadata(data)
        title = data.get("title")
        if title is not None:
            # If we already have a custom title, it needs to be in metadata
            # regardless of what extract_metadata returns.
            metadata["title"] = title

        return metadata

    def get_title(self, metadata):
        """
        Compute the title for a document.

        If the document has a ``title`` metadata field, use that as the title.  Otherwise, compute and return a reasonable
        default value from several fields in the metadata:

            * The "title" field if it exists
            * The first header in Markdown or reStructuredText (with
        "#" characters stripped)
            * The value of an "abstract" field if it exists (see :func:`get_abstract()`)
        """
        title = metadata.get("title")
        if title is not None:
            return title
        return self.compute_title(metadata) or "<untitled>"

    def compute_title(self, metadata):
        return None

    def extract_metadata(self, metadata):
        return {}

    def get_location(self, metadata):
        return None

    def to_string(self, metadata):
        warn(DeprecationWarning("This method was replaced by get_title", stacklevel=2))
        return self.get_title()


class DefaultEvent(BaseEvent):
    key = "default"

    def extract_metadata(self, data):
        """
        Extracts metadata from a Sentry event.

        :param data: A dictionary containing the event data.
        :returns: A dictionary containing the title of the event,
        or ``None`` if it doesn't have one.

            The title is obtained by looking at either the formatted message or message field in a Sentry log entry, and
        taking only its first line (i.e., truncating after any newline character). If neither of those fields are present, then an unlabeled title is used
        instead (i.e., "unlabeled event").

            .. note :: This function does not return anything because it mutates `data` directly! It's important to pass
        in a copy of `data` rather than modifying `data` itself so that other code can use unmodified versions as well.
        """
        message = strip(
            get_path(data, "logentry", "formatted") or get_path(data, "logentry", "message")
        )

        if message:
            title = truncatechars(message.splitlines()[0], 100)
        else:
            title = "<unlabeled event>"

        return {"title": title}
