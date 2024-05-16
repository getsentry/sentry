import re
from collections.abc import Sequence

# These will be used with `(?x)` tells the regex compiler to ignore comments
# and unescaped whitespace, so we can use newlines and indentation for better legibility.
_parameterization_regex_components = {
    "email": r"""(?P<email>
        [a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*
    )""",
    "url": r"""(?P<url>
        \b(wss?|https?|ftp)://[^\s/$.?#].[^\s]*
    )""",
    "hostname": r"""(?P<hostname> # Top 100 TLDs. The complete list is 1000s long.
        \b
        ([a-zA-Z0-9\-]{1,63}\.)+?
        (
            (COM|NET|ORG|JP|DE|UK|FR|BR|IT|RU|ES|ME|GOV|PL|CA|AU|CN|CO|IN|NL|EDU|INFO|EU|CH|ID|AT|KR|CZ|MX|BE|TV|SE|TR|TW|AL|UA|IR|VN|CL|SK|LY|CC|TO|NO|FI|US|PT|DK|AR|HU|TK|GR|IL|NEWS|RO|MY|BIZ|IE|ZA|NZ|SG|EE|TH|IO|XYZ|PE|BG|HK|RS|LT|LINK|PH|CLUB|SI|SITE|MOBI|BY|CAT|WIKI|LA|GA|XXX|CF|HR|NG|JOBS|ONLINE|KZ|UG|GQ|AE|IS|LV|PRO|FM|TIPS|MS|SA|APP)|
            (com|net|org|jp|de|uk|fr|br|it|ru|es|me|gov|pl|ca|au|cn|co|in|nl|edu|info|eu|ch|id|at|kr|cz|mx|be|tv|se|tr|tw|al|ua|ir|vn|cl|sk|ly|cc|to|no|fi|us|pt|dk|ar|hu|tk|gr|il|news|ro|my|biz|ie|za|nz|sg|ee|th|io|xyz|pe|bg|hk|rs|lt|link|ph|club|si|site|mobi|by|cat|wiki|la|ga|xxx|cf|hr|ng|jobs|online|kz|ug|gq|ae|is|lv|pro|fm|tips|ms|sa|app)
        )
        \b
    )""",
    "ip": r"""(?P<ip>
        (
            ([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|
            ([0-9a-fA-F]{1,4}:){1,7}:|
            ([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|
            ([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|
            ([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|
            ([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|
            ([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|
            [0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|
            :((:[0-9a-fA-F]{1,4}){1,7}|:)|
            fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|
            ::(ffff(:0{1,4}){0,1}:){0,1}
            ((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}
            (25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|
            ([0-9a-fA-F]{1,4}:){1,4}:
            ((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}
            (25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\b
        ) |
        (
            \b((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}
            (25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\b
        )
    )""",
    "uuid": r"""(?P<uuid>
        \b
            [0-9a-fA-F]{8}-
            [0-9a-fA-F]{4}-
            [0-9a-fA-F]{4}-
            [0-9a-fA-F]{4}-
            [0-9a-fA-F]{12}
        \b
    )""",
    "sha1": r"""(?P<sha1>
        \b[0-9a-fA-F]{40}\b
    )""",
    "md5": r"""(?P<md5>
        \b[0-9a-fA-F]{32}\b
    )""",
    "date": r"""(?P<date>
        # No word boundaries required around dates. Should there be?
        # RFC822, RFC1123, RFC1123Z
        ((?:Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{2,4}\s\d{1,2}:\d{1,2}(:\d{1,2})?\s([-\+][\d]{2}[0-5][\d]|(?:UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z])))
        |
        # Similar to RFC822, but "Mon Jan 02, 1999", "Jan 02, 1999"
        (((?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s[0-3]\d,\s\d{2,4})
        |
        # RFC850
        ((?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),\s\d{2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}\s\d{2}:\d{2}:\d{2}\s(?:UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z]))
        |
        # RFC3339, RFC3339Nano
        (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?([+-]?\d{2}:\d{2})?)
        |
        # Datetime:
        (\d{4}-?[01]\d-?[0-3]\d\s[0-2]\d:[0-5]\d:[0-5]\d)(\.\d+)?
        |
        # Kitchen
        (\d{1,2}:\d{2}(:\d{2})?(?: [aApP][Mm])?)
        |
        # Date
        (\d{4}-[01]\d-[0-3]\d)
        |
        # Time
        ([0-2]\d:[0-5]\d:[0-5]\d)
        |
        # Old Date Formats, TODO: possibly safe to remove?
        (
            (\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|
            (\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|
            (\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))
        ) |
        (
            \b(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+)?
            (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+
            ([\d]{1,2})\s+
            ([\d]{2}:[\d]{2}:[\d]{2})\s+
            [\d]{4}
        ) |
        (
            \b(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s+)?
            (0[1-9]|[1-2]?[\d]|3[01])\s+
            (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+
            (19[\d]{2}|[2-9][\d]{3})\s+
            (2[0-3]|[0-1][\d]):([0-5][\d])
            (?::(60|[0-5][\d]))?\s+
            ([-\+][\d]{2}[0-5][\d]|(?:UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z]))
        ) |
        (datetime.datetime\(.*?\))
    )""",
    "duration": r"""(?P<duration>
        \b
        (\d+ms) |
        (\d(\.\d+)?s)
        \b
    )""",
    "hex": r"""(?P<hex>
        \b0[xX][0-9a-fA-F]+\b
    )""",
    "float": r"""(?P<float>
        -\d+\.\d+\b |
        \b\d+\.\d+\b
    )""",
    "int": r"""(?P<int>
        -\d+\b |
        \b\d+\b
    )""",
    "quoted_str": r"""(?<==)(?P<quoted_str>
        # Using `=`lookbehind which guarantees we'll only match the value half of key-value pairs,
        # rather than all quoted strings
        '([^']+)' |
        "([^"]+)"
    )""",
    "bool": r"""(?<==)(?P<bool>
        # TUsing `=`lookbehind which guarantees we'll only match the value half of key-value pairs,
        # rather than all instances of the words 'true' and 'false'.
        True |
        true |
        False |
        false
    )""",
}


def make_regex_from_patterns(pattern_keys: Sequence[str]) -> re.Pattern:
    # The `(?x)` tells the regex compiler to ignore comments and unescaped whitespace,
    # so we can use newlines and indentation for better legibility in patterns above.

    # raises: KeyError on pattern key not in the _parameterization_regex_components dict
    return re.compile(
        rf"(?x){'|'.join(_parameterization_regex_components[k] for k in pattern_keys)}"
    )
