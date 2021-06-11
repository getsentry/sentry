{
  const {TokenConverter, TermOperator, FilterType} = options;
  const tc = new TokenConverter(text, location);
}

search
  = spaces terms:term* {
      return terms.flat();
    }

term
  = (boolean_operator / paren_group / filter / free_text) spaces

boolean_operator
  = (or_operator / and_operator) {
      return tc.tokenLogicBoolean(text().toUpperCase());
    }

paren_group
  = open_paren spaces:spaces inner:term+ closed_paren {
      return tc.tokenLogicGroup([spaces, ...inner].flat());
    }

free_text
  = free_text_quoted / free_text_unquoted

free_text_unquoted
  = (!filter !boolean_operator (free_parens / [^()\n ]+) spaces)+ {
      return tc.tokenFreeText(text(), false);
    }

free_text_quoted
  = value:quoted_value {
      return tc.tokenFreeText(value.value, true);
    }

free_parens
  = open_paren free_text? closed_paren

// All key:value filter types

filter
  = date_filter
  / specific_date_filter
  / rel_date_filter
  / duration_filter
  / boolean_filter
  / numeric_in_filter
  / numeric_filter
  / aggregate_filter
  / aggregate_date_filter
  / aggregate_rel_date_filter
  / has_filter
  / is_filter
  / text_in_filter
  / text_filter

// filter for dates
date_filter
  = key:search_key sep op:operator value:iso_8601_date_format {
      return tc.tokenFilter(FilterType.Date, key, value, op, false);
    }

// filter for exact dates
specific_date_filter
  = key:search_key sep value:iso_8601_date_format {
      return tc.tokenFilter(FilterType.SpecificDate, key, value, TermOperator.Default, false);
    }

// filter for relative dates
rel_date_filter
  = key:search_key sep value:rel_date_format {
      return tc.tokenFilter(FilterType.RelativeDate, key, value, TermOperator.Default, false);
    }

// filter for durations
duration_filter
  = key:search_key sep op:operator? value:duration_format {
      return tc.tokenFilter(FilterType.Duration, key, value, op, false);
    }

// boolean comparison filter
boolean_filter
  = negation:negation? key:search_key sep value:boolean_value {
      return tc.tokenFilter(FilterType.Boolean, key, value, TermOperator.Default, !!negation);
    }

// numeric in filter
numeric_in_filter
  = key:search_key sep value:numeric_in_list {
      return tc.tokenFilter(FilterType.NumericIn, key, value, TermOperator.Default, false);
    }

// numeric comparison filter
numeric_filter
  = key:search_key sep op:operator? value:numeric_value {
      return tc.tokenFilter(FilterType.Numeric, key, value, op, false);
    }

// aggregate numeric filter
aggregate_filter
  = negation:negation?
    key:aggregate_key
    sep
    op:operator?
    value:(duration_format / numeric_value / percentage_format) {
      return tc.tokenFilter(FilterType.AggregateSimple, key, value, op, !!negation);
    }

// aggregate date filter
aggregate_date_filter
  = negation:negation? key:aggregate_key sep op:operator? value:iso_8601_date_format {
      return tc.tokenFilter(FilterType.AggregateDate, key, value, op, !!negation);
    }

// filter for relative dates
aggregate_rel_date_filter
  = negation:negation? key:aggregate_key sep op:operator? value:rel_date_format {
      return tc.tokenFilter(FilterType.AggregateRelativeDate, key, value, op, !!negation);
    }

// has filter for not null type checks
has_filter
  = negation:negation? &"has" key:search_key sep value:(search_key / search_value) {
      return tc.tokenFilter(FilterType.Has, key, value, TermOperator.Default, !!negation);
    }

// is filter. Specific to issue search
is_filter
  = negation:negation? &"is" key:search_key sep value:search_value {
      return tc.tokenFilter(FilterType.Has, key, value, TermOperator.Default, !!negation);
    }

// in filter key:[val1, val2]
text_in_filter
  = negation:negation? key:text_key sep value:text_in_list {
      return tc.tokenFilter(FilterType.TextIn, key, value, TermOperator.Default, !!negation);
    }

// standard key:val filter
text_filter
  = negation:negation? key:text_key sep value:search_value {
      return tc.tokenFilter(FilterType.Text, key, value, TermOperator.Default, !!negation);
    }

// Filter keys
key
  = value:[a-zA-Z0-9_\.-]+ {
      return tc.tokenKeySimple(value.join(''), false);
    }

quoted_key
  = '"' key:key '"' {
      return tc.tokenKeySimple(key.value, true);
    }

explicit_tag_key
  = prefix:"tags" open_bracket key:search_key closed_bracket {
      return tc.tokenKeyExplicitTag(prefix, key);
    }

aggregate_key
  = name:key open_paren s1:spaces args:function_args? s2:spaces closed_paren {
      return tc.tokenKeyAggregate(name, args, s1, s2);
    }

function_args
  = arg1:key
    args:(spaces comma spaces key)* {
      return tc.tokenKeyAggregateArgs(arg1, args);
    }

search_key
  = key / quoted_key

text_key
  = explicit_tag_key / search_key

// Filter values

value
  = value:[^() ]* {
      return tc.tokenValueText(value.join(''), false);
    }

quoted_value
  = '"' value:('\\"' / [^"])* '"' {
      return tc.tokenValueText(value.join(''), true);
    }

in_value
  = (&in_value_termination [^(), ])* {
        return tc.tokenValueText(text(), false);
    }

// See: https://stackoverflow.com/a/39617181/790169
in_value_termination
  = [^(), ] (!in_value_terminator [^(), ])* in_value_terminator

in_value_terminator
  = closed_bracket / spaces comma

text_value
  = quoted_value / in_value

search_value
  = quoted_value / value

numeric_value
  = value:("-"? numeric) unit:[kmb]? &(end_set / comma / closed_bracket) {
      return tc.tokenValueNumber(value.join(''), unit);
    }

boolean_value
  = value:("true"i / "1" / "false"i / "0") end_lookahead {
      return tc.tokenValueBoolean(value);
    }

text_in_list
  = open_bracket item1:text_value items:(spaces comma spaces text_value)* closed_bracket {
      return tc.tokenValueTextList(item1, items);
    }

numeric_in_list
  = open_bracket item1:numeric_value items:(spaces comma spaces numeric_value)* closed_bracket {
      return tc.tokenValueNumberList(item1, items);
    }

// Format values

date_format = num4 "-" num2 "-" num2
time_format = "T" num2 ":" num2 ":" num2 ("." ms_format)?
ms_format   = [0-9] [0-9]? [0-9]? [0-9]? [0-9]? [0-9]?
tz_format   = [+-] num2 ":" num2

iso_8601_date_format
  = date_format time_format? ("Z" / tz_format)? end_lookahead {
      return tc.tokenValueIso8601Date(text());
    }

rel_date_format
  = sign:[+-] value:[0-9]+ unit:[wdhm] end_lookahead {
      return tc.tokenValueRelativeDate(value.join(''), sign, unit);
    }

duration_format
  = value:numeric
    unit:("ms"/"s"/"min"/"m"/"hr"/"h"/"day"/"d"/"wk"/"w")
    end_lookahead {
      return tc.tokenValueDuration(value, unit);
    }

percentage_format
  = value:numeric "%" {
      return tc.tokenValuePercentage(value);
    }

// NOTE: the order in which these operators are listed matters because for
// example, if < comes before <= it will match that even if the operator is <=
operator       = ">=" / "<=" / ">" / "<" / "=" / "!="
or_operator    = "OR"i  &(" " / eol)
and_operator   = "AND"i &(" " / eol)
numeric        = [0-9]+ ("." [0-9]*)? { return text(); }
open_paren     = "("
closed_paren   = ")"
open_bracket   = "["
closed_bracket = "]"
sep            = ":"
negation       = "!"
comma          = ","
spaces         = " "* { return tc.tokenSpaces(text()) }
eol            = !.
num            = [0-9]
num2           = num num
num4           = num num num num

end_set = " " / "\\" / ")" / eol
end_lookahead = &end_set
