from typing import int
def unquote_literal(value: str) -> str:
    if len(value) < 2 or value[0] != '"' or value[-1] != '"':
        return value
    else:
        return value[1:-1]
