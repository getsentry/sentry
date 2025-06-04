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
  = quoted_value / in_value / empty_value

empty_value
  = spaces {
    return tc.tokenValueText(text(), false);
  }

in_value
  = (in_value_char)+ {
    return tc.tokenValueText(text(), false);
  }

quoted_value
  = '"' value:('\\"' / [^"])* '"' {
    return tc.tokenValueText(value.join(''), true);
  }

in_value_termination
  = in_value_char (!in_value_end in_value_char)* in_value_end

in_value_char
  = [^,]

in_value_end
  = (spaces comma)

comma = ","
spaces = " "*
