{
    const { TokenConverter, config = {} } = options;
    const tc = new TokenConverter({text, location, config});
}

value = iso_8601_date_format / rel_date_format

num2 = [0-9] [0-9]
num4 = [0-9] [0-9] [0-9] [0-9]

date_format = num4 "-" num2 "-" num2
time_format = "T" num2 ":" num2 ":" num2 ("." ms_format)?
ms_format   = [0-9] [0-9]? [0-9]? [0-9]? [0-9]? [0-9]?
tz_format   = [+-] num2 ":" num2

iso_8601_date_format
  = date:date_format time:time_format? tz:("Z" / tz_format)? {
      return tc.tokenValueIso8601Date(text(), date, time, tz);
    }

rel_date_format
  = sign:[+-]? value:[0-9]+ unit:[wdhm] {
      return tc.tokenValueRelativeDate(value.join(''), sign, unit);
    }
