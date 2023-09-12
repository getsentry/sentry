def is_ascii_control(char: str) -> bool:
    return ord(char) < 32 or ord(char) == 127
