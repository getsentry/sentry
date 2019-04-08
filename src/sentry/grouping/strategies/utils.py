from __future__ import absolute_import

PAIRS = {
    '(': ')',
    '{': '}',
    '[': ']',
    '<': '>',
}


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
                        rv.append(replacement(s[pair_start + 1:idx], pair_start))
                    else:
                        rv.append(replacement)
        elif depth == 0:
            rv.append(char)

    return ''.join(rv)


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
                buf.append(s[end:idx + 1])
                end = idx + 1
        elif not stack:
            if char.isspace():
                if buf:
                    rv.append(buf)
                buf = []
            else:
                buf.append(s[end:idx + 1])
            end = idx + 1

    if buf:
        rv.append(buf)

    return [''.join(x) for x in rv]
