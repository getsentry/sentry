import ipaddress
from collections.abc import Callable
from copy import deepcopy
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone
from ipaddress import IPv4Address, IPv6Address, ip_address
from random import choice, randint
from typing import Any
from urllib.parse import urlparse, urlunparse
from uuid import UUID, uuid4

import orjson
import petname
from dateutil.parser import parse as parse_datetime
from django.utils.text import slugify

UPPER_CASE_HEX = {"A", "B", "C", "D", "E", "F"}
UPPER_CASE_NON_HEX = {
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
}
LOWER_CASE_HEX = {c.lower() for c in UPPER_CASE_HEX}
LOWER_CASE_NON_HEX = {c.lower() for c in UPPER_CASE_NON_HEX}

MAX_IPV4 = (2**ipaddress.IPV4LENGTH) - 1
MAX_IPV6 = (2**ipaddress.IPV6LENGTH) - 1


def random_ipv4():
    return str(ipaddress.IPv4Address(randint(0, MAX_IPV4)))


def random_ipv6():
    return str(ipaddress.IPv6Address(randint(0, MAX_IPV6)))


class SanitizationError(Exception):
    """
    A catch-all class for sanitization errors.
    """


class InvalidJSONError(SanitizationError):
    """
    Thrown when the supplied JSON is not recognizable as a serialized Django model.
    """


class UnexpectedModelError(SanitizationError):
    """
    Thrown when the model does not match that specified by the field supplied by a `set_*`
    function caller.
    """


class UnrecognizedDatetimeError(SanitizationError):
    """
    Thrown when we encounter a date that has not been interned at startup time.
    """


@dataclass
class SanitizableField:
    """
    A pairing a of a `NormalizedModelName` with a field in that model, specifying the target for a
    sanitization operation.
    """

    from sentry.backup.dependencies import NormalizedModelName

    model: NormalizedModelName
    field: str

    def validate_json_model(self, json: Any) -> None:
        """
        Validates the JSON model is shaped the way we expect a serialized Django model to be,
        and that we have the right kind of model for this `SanitizableField`. Raises errors if there
        is a validation failure.
        """

        model_name = json.get("model", None)
        if model_name is None:
            raise InvalidJSONError(
                "JSON is not properly formatted, must be a serialized Django model"
            )
        if model_name != str(self.model):
            raise UnexpectedModelError(f"Expected model `{model_name}`, got `{str(self.model)}`")
        return None


def _get_field_value(json: Any, field: SanitizableField) -> Any | None:
    return json.get("fields", {}).get(field.field, None)


def _set_field_value(json: Any, field: SanitizableField, value: Any) -> Any:
    json.get("fields", {})[field.field] = value
    return value


def default_string_sanitizer(old: str) -> str:
    """
    Default string randomizer. Looks at the characters present in the source string to create a new,
    random string from a roughly similar set of characters.
    """

    has_upper_case_hex = False
    has_upper_case_non_hex = False
    has_lower_case_hex = False
    has_lower_case_non_hex = False
    has_digit = False
    other_ascii = set()

    for char in old:
        if char in UPPER_CASE_HEX:
            has_upper_case_hex = True
        elif char in UPPER_CASE_NON_HEX:
            has_upper_case_non_hex = True
        elif char in LOWER_CASE_HEX:
            has_lower_case_hex = True
        elif char in LOWER_CASE_NON_HEX:
            has_lower_case_non_hex = True
        elif char.isdigit():
            has_digit = True
        elif char.isascii():
            other_ascii.add(char)

    chars = "".join(other_ascii)
    if has_upper_case_hex:
        chars += "".join(UPPER_CASE_HEX)
    if has_upper_case_non_hex:
        chars += "".join(UPPER_CASE_NON_HEX)
    if has_lower_case_hex:
        chars += "".join(LOWER_CASE_HEX)
    if has_lower_case_non_hex:
        chars += "".join(LOWER_CASE_NON_HEX)
    if has_digit:
        chars += "0123456789"

    return "".join([choice(list(chars)) for _ in range(len(old))])


class Sanitizer:
    """
    Performs sanitization for a complete export JSON - that is, it replaces PII and other specific
    data with pseudo-randomized equivalents of roughly the same shape. It is concerned with
    replacing two kinds of data:

    1. Strings are randomly replaced and interned via the `set_string()` method. So if the name
       "Foo" (case sensitive) appears multiple times in the file, each occurrence will be replaced
       with the same randomly generated data, say "Bar". If only part of a string should be
       maintained, string could be chopped up as necessary before being fed to `map_string()` in
       parts. For example, a set of emails from the same domain like `a@test.com`, `b@test.com`, and
       `c@test.com` can be passed to `map_string()` as `map_string("test.com", "fake.com")`,
       `map_string("a", "x")`, `map_string("b", "y")`, and `map_string("c", "z")`. This will
       generate new sanitized emails that still share the same (sanitized) domain structure.
    2. Datetimes are randomly adjusted such that they are different from the original dates, but
       still maintain their global ordering in the import. That is, a datetime will be different
       from its original value, but will still come before the next highest date that appears in the
       entire export JSON that was passed in. This is done via the `set_datetime()` method.
       Additionally, at init time, a `datetime_offset` argument may be passed, which will uniformly
       adjust all dates by the amount specified.

    The `map_*` methods return new random values wholesale, while the corresponding `set_*` methods
    are used for updating a particular instance of a JSON-serialized Django model with that value.
    In most cases, using `set_*` is preferred to `map_*`.

    Note that special cases of these types may be sanitized with wrapping helpers (`set_email()`,
    `set_name()`, etc), but all of these ultimately call into `set_string()` and `set_datetime()`.
    """

    json: Any
    interned_strings: dict[str, str]
    interned_datetimes: dict[datetime, datetime]

    def __init__(self, export: Any, datetime_offset: timedelta | None = None):
        self.json = export
        self.interned_strings = {"": ""}  # Always map empty string to itself.
        self.interned_datetimes = dict()

        # Walk the data once, extracting any dates into a set.
        datetimes = set()
        for model in self.json:
            for value in model["fields"].values():
                try:
                    datetimes.add(parse_datetime(value).replace(tzinfo=UTC))
                except Exception:
                    continue

        # Order the values into a list.
        ordered_datetimes = sorted(datetimes)
        count = len(ordered_datetimes)

        # Walk the ordered values. Each date is adjusted to be a random value between halfway to the
        # previous value, and halfway to the next one.
        delta = timedelta() if datetime_offset is None else datetime_offset
        for i, dt in enumerate(ordered_datetimes):
            curr = int(datetime.timestamp(dt) * 1000)
            prev = int(datetime.timestamp(ordered_datetimes[i - 1] if i > 0 else dt) * 1000)
            next = int(datetime.timestamp(ordered_datetimes[i + 1] if i < count - 1 else dt) * 1000)
            start = int((curr - prev) / 2) + prev
            until = int((next - curr) / 2) + curr
            rand = randint(start, until) + (int(delta.total_seconds()) * 1000)
            self.interned_datetimes[dt] = datetime.fromtimestamp(rand / 1000.0, tz=timezone.utc)

    def map_datetime(self, old: datetime) -> datetime:
        """
        Sanitize a datetime by replacing it with a different, but still correctly ordered,
        alternative.

        If you wish to update an actual JSON model in-place with this newly generated string,
        `set_string()` is the preferred method for doing so.
        """

        try:
            return self.interned_datetimes[old]
        except KeyError:
            raise UnrecognizedDatetimeError(
                f"The datetime `{old}` has not been interned as a valid sanitizable datetime"
            )

    def map_email(self, old: str) -> str:
        """
        Map an email in a manner that retains domain relationships - ie, all sanitized emails from
        domain `@foo` will now be from `@bar`. If the `old` string is not a valid email (ie, does
        not have exactly 1 `@` character), it will be treated as a regular string. This ensures that
        all identical existing emails are swapped with identical replacements everywhere they occur.

        If you wish to update an actual JSON model in-place with this newly generated email,
        `set_email()` is the preferred method for doing so.
        """

        if old.count("@") != 1 or old.find("@") == 0 or old.find("@") >= len(old) - 1:
            return self.map_string(old)

        return "@".join([self.map_string(p) for p in old.split("@")])

    def map_ip(self, old: str) -> str:
        """
        Maps an IP with some randomly generated alternative. If the `old` IP has already been seen,
        the already-generated value for that existing key will be used instead. If it has not, we'll
        generate a new one. This ensures that all identical existing IPs are swapped with identical
        replacements everywhere they occur.

        If the `old` string is not a valid IP, it will be treated as a regular string.

        If you wish to update an actual JSON model in-place with this newly generated IP, `set_ip()`
        is the preferred method for doing so.
        """

        interned = self.interned_strings.get(old)
        if interned is not None:
            return interned

        try:
            old_ip = ip_address(old)
        except ValueError:
            return self.map_string(old)
        else:
            if isinstance(old_ip, IPv4Address):
                self.interned_strings[old] = random_ipv4()
            elif isinstance(old_ip, IPv6Address):
                self.interned_strings[old] = random_ipv6()
            return self.interned_strings[old]

    def map_json(self, old_json: Any, new_json: Any) -> Any:
        """
        Maps a JSON object. If the `old` JSON object has already been seen, the already-generated
        value for that existing key will be used instead. If it has not, we'll generate a new one.
        This ensures that all identical existing JSON objects are swapped with identical
        replacements everywhere they occur.

        If you wish to update an actual model in-place with this newly generated name,
        `set_json()` is the preferred method for doing so.
        """

        old_serialized = orjson.dumps(
            old_json, option=orjson.OPT_UTC_Z | orjson.OPT_NON_STR_KEYS
        ).decode()
        interned = self.interned_strings.get(old_serialized)
        if interned is not None:
            return orjson.loads(interned)

        new_serialized = orjson.dumps(
            new_json, option=orjson.OPT_UTC_Z | orjson.OPT_NON_STR_KEYS
        ).decode()
        self.interned_strings[old_serialized] = new_serialized
        return new_json

    def map_name(self, old: str) -> str:
        """
        Maps a proper noun name with some randomly generated "petname" value (ex: "Hairy Tortoise").
        If the `old` name has already been seen, the already-generated value for that existing key
        will be used instead. If it has not, we'll generate a new one. This ensures that all
        identical existing names are swapped with identical replacements everywhere they occur.

        If you wish to update an actual JSON model in-place with this newly generated name,
        `set_name()` is the preferred method for doing so.
        """

        return self.map_string(old, lambda old: petname.generate(2, " ", letters=len(old)).title())

    def map_name_and_slug_pair(self, old_name: str, old_slug: str | None) -> tuple[str, str | None]:
        """
        Maps a pair of a proper noun name and its matching slug with some randomly generated
        "petname" values (ex: "Hairy Tortoise" and "hairy-tortoise"). If the existing value of the
        name has already been seen, the already-generated value for that existing key will be used
        to generate both the name and the slug instead. If it has not, we'll generate a new one.
        This ensures that all identical existing name/slug pairs are swapped with identical
        replacements everywhere they occur.

        If you wish to update an actual JSON model in-place with this newly generated name,
        `set_name_and_slug_pair()` is the preferred method for doing so.
        """

        name = self.map_name(old_name)
        slug = None if old_slug is None else slugify(old_name.lower().replace("_", "-").strip("-"))
        return (name, slug)

    def map_string(
        self, old: str, generate: Callable[[str], str] = default_string_sanitizer
    ) -> str:
        """
        Maps a source string with some randomly generated value. If the `old` string has already
        been seen, the already-generated value for that existing key will be used instead. If it has
        not, we'll use the callback to generate a new one. This ensures that all identical existing
        strings are swapped with identical replacements everywhere they occur.

        If you wish to update an actual JSON model in-place with this newly generated string,
        `set_string()` is the preferred method for doing so.
        """

        interned = self.interned_strings.get(old)
        if interned is not None:
            return interned

        new = generate(old)
        self.interned_strings[old] = new
        return new

    def map_url(self, old: str) -> str:
        """
        Map an URL in a manner that retains domain relationships - ie, all sanitized URLs from
        domain `.foo` will now be from `.bar`. Scheme, subdomains, paths, etc will be retained in
        kind (ie: if we have a path, we will sanitize it with a similar, interned one). This ensures
        that all identical existing URLs are swapped with identical replacements everywhere they
        occur.

        If the `old` string is not a valid URL , it will be treated as a regular string.

        If you wish to update an actual JSON model in-place with this newly generated URL,
        `set_URL()` is the preferred method for doing so.
        """

        url = urlparse(old)
        hostname = url.hostname
        if not hostname:
            return self.map_string(old)

        new_path = (
            "" if not url.path else ".".join([self.map_string(p) for p in url.path.split(".")])
        )
        new_query = (
            "" if not url.query else ".".join([self.map_string(q) for q in url.query.split(".")])
        )
        return urlunparse(
            url._replace(
                scheme=self.map_string(url.scheme) if url.scheme else "",
                netloc=".".join([self.map_string(d) for d in hostname.split(".")]),
                path=new_path,
                query=new_query,
                fragment=self.map_string(url.fragment) if url.fragment else "",
            )
        )

    def map_uuid(self, old: str) -> str:
        """
        Maps a UUID. If the `old` UUID has already been seen, the already-generated value for that
        existing key will be used instead. If it has not, we'll generate a new one. This ensures
        that all identical existing UUIDs are swapped with identical replacements everywhere they
        occur.

        If you wish to update an actual JSON model in-place with this newly generated name,
        `set_uuid()` is the preferred method for doing so.
        """

        return self.map_string(old, lambda _: str(uuid4()))

    def set_datetime(self, json: Any, field: SanitizableField) -> datetime | None:
        """
        Replaces a datetime by replacing it with a different, but still correctly ordered,
        alternative.

        This method updates the JSON in-place if the specified field is a non-null value, then
        returns the newly generated replacement. If the specified field could not be found in the
        supplied JSON model, `None` is returned instead.

        If you wish to merely generate a string without updating the JSON in-place, consider using
        `map_datetime()` instead.
        """

        field.validate_json_model(json)
        old = _get_field_value(json, field)
        if old is None:
            return None

        parsed = None
        try:
            parsed = parse_datetime(old)
        except (TypeError, ValueError):
            raise TypeError("Existing value must be a valid ISO-8601 datetime string")

        return None if parsed is None else _set_field_value(json, field, self.map_datetime(parsed))

    def set_email(self, json: Any, field: SanitizableField) -> str | None:
        """
        Replaces an email in a manner that retains domain relationships - ie, all sanitized emails
        from domain `@foo` will now be from `@bar`. If the `old` string is not a valid email (ie,
        does not have exactly 1 `@` character), it will be treated as a regular string.

        This method updates the JSON in-place if the specified field is a non-null value, then
        returns the newly generated replacement. If the specified field could not be found in the
        supplied JSON model, `None` is returned instead.

        If you wish to merely generate a email without updating the JSON in-place, consider using
        `map_email()` instead.
        """

        field.validate_json_model(json)
        old = _get_field_value(json, field)
        if old is None:
            return None
        if not isinstance(old, str):
            raise TypeError("Existing value must be a string")

        return _set_field_value(json, field, self.map_email(old))

    def set_ip(
        self,
        json: Any,
        field: SanitizableField,
    ) -> str | None:
        """
        Replaces a IP with a randomly generated value. If the existing value of the IP has
        already been seen, the already-generated value for that existing key will be used instead.
        If it has not, we'll generate a new one. This ensures that all identical existing IPs are
        swapped with identical replacements everywhere they occur.

        This method updates the JSON in-place if the specified field is a non-null value, then
        returns the newly generated replacement. If the specified field could not be found in the
        supplied JSON model, `None` is returned instead.

        If you wish to merely generate a string without updating the JSON in-place, consider using
        `map_ip()` instead.
        """

        field.validate_json_model(json)
        old = _get_field_value(json, field)
        if old is None:
            return None
        if not isinstance(old, str):
            raise TypeError("Existing value must be a string")

        return _set_field_value(json, field, self.map_ip(old))

    def set_json(
        self,
        json: Any,
        field: SanitizableField,
        replace_with: Any,
    ) -> Any | None:
        """
        Replaces a JSON object with a randomly generated value. If the existing value of the JSON
        object has already been seen, the already-generated value for that existing key will be used
        instead. If it has not, we'll generate a new one. This ensures that all identical existing
        JSON objects are swapped with identical replacements everywhere they occur.

        This method updates the owning model in-place if the specified field is a non-null value,
        then returns the newly generated replacement. If the specified field could not be found in
        the supplied owning model, `None` is returned instead.

        If you wish to merely generate a string without updating the owning model in-place, consider
        using `map_json()` instead.
        """

        field.validate_json_model(json)
        old = _get_field_value(json, field)
        if old is None:
            return None

        return _set_field_value(json, field, self.map_json(old, replace_with))

    def set_name(
        self,
        json: Any,
        field: SanitizableField,
    ) -> str | None:
        """
        Replaces a proper noun name with some randomly generated "petname" value (ex: "Hairy
        Tortoise"). If the existing value of the name has already been seen, the already-generated
        value for that existing key will be used instead. If it has not, we'll generate a new one.
        This ensures that all identical existing names are swapped with identical replacements
        everywhere they occur.

        This method updates the JSON in-place if the specified field is a non-null value, then
        returns the newly generated replacement. If the specified field could not be found in the
        supplied JSON model, `None` is returned instead.

        If you wish to merely generate a string without updating the JSON in-place, consider using
        `map_name()` instead.
        """

        field.validate_json_model(json)
        old = _get_field_value(json, field)
        if old is None:
            return None
        if not isinstance(old, str):
            raise TypeError("Existing value must be a string")

        return _set_field_value(json, field, self.map_name(old))

    def set_name_and_slug_pair(
        self, json: Any, name_field: SanitizableField, slug_field: SanitizableField
    ) -> tuple[str | None, str | None]:
        """
        Replaces a pair of a proper noun name and its matching slug with some randomly generated
        "petname" values (ex: "Hairy Tortoise" and "hairy-tortoise"). If the existing value of the
        name has already been seen, the already-generated value for that existing key will be used
        to generate both the name and the slug instead. If it has not, we'll generate a new one.
        This ensures that all identical existing name/slug pairs are swapped with identical
        replacements everywhere they occur.

        This method updates the JSON in-place if the specified field is a non-null value, then
        returns the newly generated replacement. If the specified field could not be found in the
        supplied JSON model, `None` is returned instead.

        If you wish to merely generate a pair of strings without updating the JSON in-place,
        consider using `map_name()` instead.
        """

        name_field.validate_json_model(json)
        old_name = _get_field_value(json, name_field)
        if old_name is None:
            return (None, None)
        if not isinstance(old_name, str):
            raise TypeError("Existing name value must be a string")

        slug_field.validate_json_model(json)
        old_slug = _get_field_value(json, slug_field)
        if old_slug is None:
            return (_set_field_value(json, name_field, self.map_name(old_name)), None)
        if not isinstance(old_slug, str):
            raise TypeError("Existing slug value must be a string")

        (name, slug) = self.map_name_and_slug_pair(old_name, old_slug)
        _set_field_value(json, name_field, self.map_name(old_name))
        if slug is not None:
            _set_field_value(json, slug_field, slugify(name.lower().replace("_", "-").strip("-")))

        return (name, slug)

    def set_string(
        self,
        json: Any,
        field: SanitizableField,
        generate: Callable[[str], str] = default_string_sanitizer,
    ) -> str | None:
        """
        Replaces a string with some randomly generated value. If the existing value of the string
        has already been seen, the already-generated value for that existing key will be used
        instead. If it has not, we'll use the callback to generate a new one. This ensures that all
        identical existing strings are swapped with identical replacements everywhere they occur.

        This method updates the JSON in-place if the specified field is a non-null value, then
        returns the newly generated replacement. If the specified field could not be found in the
        supplied JSON model, `None` is returned instead.

        If you wish to merely generate a string without updating the JSON in-place, consider using
        `map_string()` instead.
        """

        field.validate_json_model(json)
        old = _get_field_value(json, field)
        if old is None:
            return None
        if not isinstance(old, str):
            raise TypeError("Existing value must be a string")

        return _set_field_value(json, field, self.map_string(old, generate))

    def set_url(
        self,
        json: Any,
        field: SanitizableField,
    ) -> str | None:
        """
        Replace a URL in a manner that retains domain relationships - ie, all sanitized URLs from
        domain `.foo` will now be from `.bar`. Scheme, subdomains, paths, etc will be retained in
        kind (ie: if we have a path, we will sanitize it with a similar, interned one). This ensures
        that all identical existing URLs are swapped with identical replacements everywhere they
        occur.

        If the `old` string is not a valid URL , it will be treated as a regular string.

        This method updates the JSON in-place if the specified field is a non-null value, then
        returns the newly generated replacement. If the specified field could not be found in the
        supplied JSON model, `None` is returned instead.

        If you wish to merely generate a string without updating the JSON in-place, consider using
        `map_url()` instead.
        """

        field.validate_json_model(json)
        old = _get_field_value(json, field)
        if old is None:
            return None
        if not isinstance(old, str):
            raise TypeError("Existing value must be a string")

        return _set_field_value(json, field, self.map_url(old))

    def set_uuid(
        self,
        json: Any,
        field: SanitizableField,
    ) -> str | None:
        """
        Replaces a UUID with a randomly generated value. If the existing value of the UUID has
        already been seen, the already-generated value for that existing key will be used instead.
        If it has not, we'll generate a new one. This ensures that all identical existing UUIDs are
        swapped with identical replacements everywhere they occur.

        This method updates the JSON in-place if the specified field is a non-null value, then
        returns the newly generated replacement. If the specified field could not be found in the
        supplied JSON model, `None` is returned instead.

        If you wish to merely generate a string without updating the JSON in-place, consider using
        `map_uuid()` instead.
        """

        field.validate_json_model(json)
        old = _get_field_value(json, field)
        if old is None:
            return None
        if not isinstance(old, str):
            raise TypeError("Existing value must be a string")

        # Will throw an error if this is not a valid UUID.
        UUID(old)

        return _set_field_value(json, field, self.map_uuid(old))


def sanitize(export: Any, datetime_offset: timedelta | None = None) -> Any:
    """
    Sanitize an entire export JSON.
    """

    # Import here to prevent circular dependencies.
    from sentry.backup.dependencies import NormalizedModelName, get_model

    sanitizer = Sanitizer(export, datetime_offset)
    sanitized: list[Any] = []
    for item in sanitizer.json:
        clone = deepcopy(item)
        model_name = NormalizedModelName(clone["model"])
        model_class = get_model(model_name)
        if model_class is None:
            continue

        model_class.sanitize_relocation_json(clone, sanitizer)  # type: ignore[attr-defined]
        sanitized.append(clone)

    return sanitized
