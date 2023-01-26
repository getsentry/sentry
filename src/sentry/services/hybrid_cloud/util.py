def flags_to_bits(*flag_values: bool) -> int:
    bits = 0
    for (index, value) in enumerate(flag_values):
        if value:
            bits |= 1 << index
    return bits
