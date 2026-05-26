// @peggy-loader allowedStartRules: percentage, duration, size, text_in_list, date
{
  const {TokenConverter, config = {}} = options;
  const tc = TokenConverter ? new TokenConverter({text, location, config}) : undefined;
}

percentage
  = value:numeric unit:"%"? {
      return {value, unit};
    }

duration
  = value:numeric unit:duration_unit? {
      return {value, unit};
    }

duration_unit = "ms"/"s"/"min"/"m"/"hr"/"h"/"day"/"d"/"wk"/"w"

size
  = value:numeric unit:size_unit? {
      return {value, unit};
    }

size_unit = bit_unit / byte_unit

bit_unit  = "bit"i / "kib"i / "mib"i / "gib"i / "tib"i / "pib"i / "eib"i / "zib"i / "yib"i
byte_unit = "bytes"i / "nb"i / "kb"i / "mb"i / "gb"i / "tb"i / "pb"i / "eb"i / "zb"i / "yb"i

numeric = [0-9]+ ("." [0-9]*)? { return text(); }

text_in_list
  = item1:text_in_value
    items:item* {
      return tc.tokenValueTextList(item1, items);
    }

item = s1:spaces c:comma s2:spaces value:(!comma text_in_value)? {
  return [s1, c, s2, value ?? [undefined, tc.tokenValueText('', false)]];
}

text_in_value
  = quoted_value / unquoted_value

unquoted_value
  = in_value_char* {
    return tc.tokenValueText(text(), false);
  }

quoted_value
  = '"' value:('\\"' / [^"])* '"' {
    return tc.tokenValueText(value.join(''), true);
  }

in_value_char
  = [^,]

comma = ","
spaces = " "*

date = iso_8601_date_format / rel_date_format

num2 = [0-9] [0-9]
num4 = [0-9] [0-9] [0-9] [0-9]

date_format = num4 "-" num2 "-" num2
time_format = "T" num2 ":" num2 ":" num2 ("." ms_format)?
ms_format   = [0-9] [0-9]? [0-9]? [0-9]? [0-9]? [0-9]?
tz_format   = [+-] num2 ":" num2

iso_8601_date_format
  = date_value:date_format time:time_format? tz:("Z" / tz_format)? {
      return tc.tokenValueIso8601Date(text(), date_value, time, tz);
    }

rel_date_format
  = sign:[+-]? value:[0-9]+ unit:[wdhm] {
      return tc.tokenValueRelativeDate(value.join(''), sign, unit);
    }
