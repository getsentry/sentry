import re

from sentry.stacktraces.platform import get_behavior_family_for_platform
from sentry.utils.safe import setdefault_path

_windecl_hash = re.compile(r"^@?(.*?)@[0-9]+$")
_rust_hash = re.compile(r"::h[a-z0-9]{16}$")
_cpp_trailer_re = re.compile(r"(\bconst\b|&)$")
_rust_blanket_re = re.compile(r"^([A-Z] as )")
_lambda_re = re.compile(
    r"""(?x)
    # gcc
    (?:
        \{
            lambda\(.*?\)\#\d+
        \}
    ) |
    # msvc
    (?:
        \blambda_[a-f0-9]{32}\b
    ) |
    # clang
    (?:
        \$_\d+\b
    )
    """
)
_anon_namespace_re = re.compile(
    r"""(?x)
    \?A0x[a-f0-9]{8}::
    """
)


PAIRS = {"(": ")", "{": "}", "[": "]", "<": ">"}


def replace_enclosed_string(s, start, end, replacement=None):
    if start not in s:
        return s

    depth = 0

    rv = []
    pair_start = None
    for idx, char in enumerate(s):
        if char == start:
            if depth == 0:
                pair_start = idx
            depth += 1
        elif char == end:
            depth -= 1
            if depth == 0:
                if replacement is not None:
                    if callable(replacement):
                        rv.append(replacement(s[pair_start + 1 : idx], pair_start))
                    else:
                        rv.append(replacement)
        elif depth == 0:
            rv.append(char)

    return "".join(rv)


def split_func_tokens(s):
    buf = []
    rv = []
    stack = []
    end = 0

    for idx, char in enumerate(s):
        if char in PAIRS:
            stack.append(PAIRS[char])
        elif stack and char == stack[-1]:
            stack.pop()
            if not stack:
                buf.append(s[end : idx + 1])
                end = idx + 1
        elif not stack:
            if char.isspace():
                if buf:
                    rv.append(buf)
                buf = []
            else:
                buf.append(s[end : idx + 1])
            end = idx + 1

    if buf:
        rv.append(buf)

    return ["".join(x) for x in rv]


def trim_function_name(function, platform, normalize_lambdas=True):
    """Given a function value from the frame's function attribute this returns
    a trimmed version that can be stored in `function_name`.  This is only used
    if the client did not supply a value itself already.
    """
    if platform == "csharp":
        return trim_csharp_function_name(function)
    if get_behavior_family_for_platform(platform) == "native":
        return trim_native_function_name(function, normalize_lambdas=normalize_lambdas)
    return function


def trim_csharp_function_name(function):
    """This trims off signatures from C# frames.  This takes advantage of the
    Unity not emitting any return values and using a space before the argument
    list.

    Note that there is disagreement between Unity and the main .NET SDK about
    the function names.  The Unity SDK emits the entire function with module
    in the `function` name similar to native, the .NET SDK emits it in individual
    parts of the frame.
    """
    return function.split(" (", 1)[0]


def trim_native_function_name(function, normalize_lambdas=True):
    if function in ("<redacted>", "<unknown>"):
        return function

    original_function = function
    function = function.strip()

    # Ensure we don't operate on objc functions
    if function.startswith(("[", "+[", "-[")):
        return function

    # Chop off C++ trailers
    while True:
        match = _cpp_trailer_re.search(function)
        if match is None:
            break
        function = function[: match.start()].rstrip()

    # Because operator<< really screws with our balancing, so let's work
    # around that by replacing it with a character we do not observe in
    # `split_func_tokens` or `replace_enclosed_string`.
    function = (
        function.replace("operator<<", "operator⟨⟨")
        .replace("operator<", "operator⟨")
        .replace("operator()", "operator◯")
        .replace(" -> ", " ⟿ ")
        .replace("`anonymous namespace'", "〔anonymousnamespace〕")
    )

    # normalize C++ lambdas.  This is necessary because different
    # compilers use different rules for now to name a lambda and they are
    # all quite inconsistent.  This does not give us perfect answers to
    # this problem but closer.  In particular msvc will call a lambda
    # something like `lambda_deadbeefeefffeeffeeff` whereas clang for
    # instance will name it `main::$_0` which will tell us in which outer
    # function it was declared.
    if normalize_lambdas:
        function = _lambda_re.sub("lambda", function)

    # Normalize MSVC anonymous namespaces from inline functions.  For inline
    # functions, the compiler inconsistently renders anonymous namespaces with
    # their hash.  For regular functions,  "`anonymous namespace'" is used.
    # The regular expression matches the trailing "::" to avoid accidental
    # replacement in mangled function names.
    if normalize_lambdas:
        function = _anon_namespace_re.sub("〔anonymousnamespace〕::", function)

    # Remove the arguments if there is one.
    def process_args(value, start):
        value = value.strip()
        if value in ("anonymous namespace", "operator"):
            return "(%s)" % value
        return ""

    function = replace_enclosed_string(function, "(", ")", process_args)

    # Resolve generic types, but special case rust which uses things like
    # <Foo as Bar>::baz to denote traits.
    def process_generics(value, start):
        # Special case for lambdas
        if value == "lambda" or _lambda_re.match(value):
            return "<%s>" % value

        if start > 0:
            return "<T>"

        # Rust special cases
        value = _rust_blanket_re.sub("", value)  # prefer trait for blanket impls
        value = replace_enclosed_string(value, "<", ">", process_generics)
        return value.split(" as ", 1)[0]

    function = replace_enclosed_string(function, "<", ">", process_generics)

    tokens = split_func_tokens(function)

    # MSVC demangles generic operator functions with a space between the
    # function name and the generics. Ensure that those two components both end
    # up in the function name.
    if len(tokens) > 1 and tokens[-1] == "<T>":
        tokens.pop()
        tokens[-1] += " <T>"

    # find the token which is the function name.  Since we chopped of C++
    # trailers there are only two cases we care about: the token left to
    # the -> return marker which is for instance used in Swift and if that
    # is not found, the last token in the last.
    #
    # ["unsigned", "int", "whatever"] -> whatever
    # ["@objc", "whatever", "->", "int"] -> whatever
    try:
        func_token = tokens[tokens.index("⟿") - 1]
    except ValueError:
        if tokens:
            func_token = tokens[-1]
        else:
            func_token = None

    if func_token:
        function = (
            func_token.replace("⟨", "<")
            .replace("◯", "()")
            .replace(" ⟿ ", " -> ")
            .replace("〔anonymousnamespace〕", "`anonymous namespace'")
        )

    # This really should never happen
    else:
        function = original_function

    # trim off rust markers
    function = _rust_hash.sub("", function)

    # trim off windows decl markers
    return _windecl_hash.sub("\\1", function)


def get_function_name_for_frame(frame, platform=None):
    """Given a frame object or dictionary this returns the actual function
    name trimmed.
    """
    if hasattr(frame, "get_raw_data"):
        frame = frame.get_raw_data()

    # if there is a raw function, prioritize the function unchanged
    if frame.get("raw_function"):
        return frame.get("function")

    # otherwise trim the function on demand
    rv = frame.get("function")
    if rv:
        return trim_function_name(rv, frame.get("platform") or platform)


def set_in_app(frame, value):
    orig_in_app = frame.get("in_app")
    if orig_in_app == value:
        return

    orig_in_app = int(orig_in_app) if orig_in_app is not None else -1
    setdefault_path(frame, "data", "orig_in_app", value=orig_in_app)
    frame["in_app"] = value
