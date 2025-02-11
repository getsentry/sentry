value = size_format

size_format
  = value:numeric
    unit:size_unit? {
      return {value, unit}
    }

size_unit = bit_unit / byte_unit

bit_unit  = "bit"i / "kib"i / "mib"i / "gib"i / "tib"i / "pib"i / "eib"i / "zib"i / "yib"i
byte_unit  = "bytes"i / "nb"i / "kb"i / "mb"i / "gb"i / "tb"i / "pb"i / "eb"i / "zb"i / "yb"i
numeric   = [0-9]+ ("." [0-9]*)? { return text(); }
