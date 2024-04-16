value = iso_8601_date_format
  / rel_date_format
  / duration_format
  / size_format
  / boolean_format
  / numeric_format
//   / aggregate_duration_filter
//   / aggregate_size_filter
//   / aggregate_numeric_filter
//   / aggregate_percentage_filter
//   / aggregate_date_filter
//   / aggregate_rel_date_filter
  / has_format
  / is_format
  / text_format

// Formats
iso_8601_date_format =
    date_format time_format? ("Z" / tz_format)? &end_value {
        // parse date
    }

rel_date_format
  = sign:[+-] value:[0-9]+ unit:[wdhm] &end_value {
        // construct a relative data
      }

duration_format
  = value:numeric
    unit:("ms"/"s"/"min"/"m"/"hr"/"h"/"day"/"d"/"wk"/"w")
    &end_value {
      // construct a duration
    }

size_format
  = value:numeric
    unit:("bit"/"nb"/"bytes"/"kb"/"mb"/"gb"/"tb"/"pb"/"eb"/"zb"/"yb"/"kib"/"mib"/"gib"/"tib"/"pib"/"eib"/"zib"/"yib")
    &end_value {
      // parse size
    }

boolean_format
  = value:("true"i / "1" / "false"i / "0") &end_value {
      // parse boolean
    }

numeric_format
  = value:("-"? numeric) unit:[kmb]? &(end_value / comma / closed_bracket) {
      // parse int/float
    }

has_format = (string/quoted_string) &end_value {
    // parse has string
  }

is_format = (string/quoted_string) &end_value {
    // parse is string
  }

text_format = string / quoted_string &end_value {
    // parse text
  }

// String primitives
text_in_value = quoted_string / in_format
in_format
  = (&in_value_termination in_value_char)+ {
        // parse in value
    }
string
  = value:[a-zA-Z0-9_.-]+ {
      // parse text
    }

quoted_string
  = '"' value:[a-zA-Z0-9_.:-]+ '"' {
        // parse text w/o quotes
    }

// See: https://stackoverflow.com/a/39617181/790169
in_value_termination
  = in_value_char (!in_value_end in_value_char)* in_value_end

in_value_char
  = [^(), ]

in_value_end
  = closed_bracket / (spaces comma)

// Primitives
num2           = [0-9] [0-9]
num4           = [0-9] [0-9] [0-9] [0-9]
date_format    = num4 "-" num2 "-" num2
time_format    = "T" num2 ":" num2 ":" num2 ("." ms_format)?
ms_format      = [0-9] [0-9]? [0-9]? [0-9]? [0-9]? [0-9]?
tz_format      = [+-] num2 ":" num2

numeric        = [0-9]+ ("." [0-9]*)? { return text(); }
comma          = ","
spaces         = " "* { return text() }
open_bracket   = "["
closed_bracket = "]"
end_value      = [\t\n )] / !.
