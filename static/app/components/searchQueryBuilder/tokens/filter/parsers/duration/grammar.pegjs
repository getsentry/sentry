value = duration_format

duration_format
  = value:numeric
    unit:duration_unit? {
      return {value, unit}
    }

duration_unit = "ms"/"s"/"min"/"m"/"hr"/"h"/"day"/"d"/"wk"/"w"
numeric        = [0-9]+ ("." [0-9]*)? { return text(); }
