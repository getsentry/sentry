{
    const { TokenConverter, config = {} } = options;
    const tc = new TokenConverter({text, location, config});
}

text_in_list
  = item1:text_in_value
    items:item* {
      return tc.tokenValueTextList(item1, items);
    }

item = s1:spaces c:comma s2:spaces value:(!comma text_in_value)? {
  return [s1, c, s2, value ?? [undefined, tc.tokenValueText('', false)]];
}

text_in_value
  = quoted_contains_value
  / quoted_value
  / contains_value
  / in_value
  / empty_value

empty_value
  = spaces {
    return tc.tokenValueText(text(), false, false);
  }

in_value
  = (in_value_char)+ {
    return tc.tokenValueText(text(), false, false);
  }

contains_value
  = "*" value:(contains_inner_value)* "*" {
      if (!value.length) {
        // Handle '**' as an empty contains value
        return tc.tokenValueText('', false, true);
      }
      if (Array.isArray(value) && value.length === 1 && value[0]?.type) {
        // quoted_value returns a tokenValueText, so mark as contains
        const v = value[0];
        v.contains = true;
        return v;
      }
      return tc.tokenValueText(value.map(v => typeof v === "string" ? v : v.text).join(''), false, true);
    }

contains_inner_value
  = [^*""]

quoted_value
  = '"' value:('\\"' / '\\*' / [^"\\])* '"' {
      return tc.tokenValueText(value.join(''), true, false);
  }

quoted_contains_value
  = '"' "*" value:('\\"' / '\\*' / [^"*\\])* "*" '"' {
      const result = tc.tokenValueText(value.join(''), true, true);
      result.text = '"' + value.join('') + '"';
      return result;
  }

in_value_termination
  = in_value_char (!in_value_end in_value_char)* in_value_end

in_value_char
  = [^,]

in_value_end
  = (spaces comma)

comma = ","
spaces = " "*
