value = percentage_format

percentage_format
  = value:numeric unit:"%"? {
      return {
        value,
        unit,
      }
    }

numeric = [0-9]+ ("." [0-9]*)? { return text(); }
