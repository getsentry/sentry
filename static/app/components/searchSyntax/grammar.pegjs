{
  const {TokenConverter, TermOperator, FilterType, config} = options;
  const tc = new TokenConverter({text, location, config});

  const opDefault = TermOperator.DEFAULT;
}

search
  = space:spaces terms:term* {
      return [space, ...terms.flat()];
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
  / size_filter
  / boolean_filter
  / numeric_in_filter
  / numeric_filter
  / aggregate_duration_filter
  / aggregate_size_filter
  / aggregate_numeric_filter
  / aggregate_percentage_filter
  / aggregate_date_filter
  / aggregate_rel_date_filter
  / has_filter
  / is_filter
  / text_in_filter
  / text_filter

// filter for dates
date_filter
  = key:search_key sep op:operator value:iso_8601_date_format &{
      return tc.predicateFilter(FilterType.DATE, key, value, op)
    } {
      return tc.tokenFilter(FilterType.DATE, key, value, op, false);
    }

// filter for exact dates
specific_date_filter
  = key:search_key sep value:iso_8601_date_format &{
      return tc.predicateFilter(FilterType.SPECIFIC_DATE, key)
    } {
      return tc.tokenFilter(FilterType.SPECIFIC_DATE, key, value, opDefault, false);
    }

// filter for relative dates
rel_date_filter
  = key:search_key sep value:rel_date_format &{
      return tc.predicateFilter(FilterType.RELATIVE_DATE, key)
    } {
      return tc.tokenFilter(FilterType.RELATIVE_DATE, key, value, opDefault, false);
    }

// filter for durations
duration_filter
  = negation:negation? key:search_key sep op:operator? value:duration_format &{
      return tc.predicateFilter(FilterType.DURATION, key)
    } {
      return tc.tokenFilter(FilterType.DURATION, key, value, op, !!negation);
    }

// filter for file size
size_filter
  = negation:negation? key:search_key sep op:operator? value:size_format &{
      return tc.predicateFilter(FilterType.SIZE, key)
    } {
      return tc.tokenFilter(FilterType.SIZE, key, value, op, !!negation);
    }

// boolean comparison filter
boolean_filter
  = negation:negation? key:search_key sep value:boolean_value &{
      return tc.predicateFilter(FilterType.BOOLEAN, key)
    } {
      return tc.tokenFilter(FilterType.BOOLEAN, key, value, opDefault, !!negation);
    }

// numeric in filter
numeric_in_filter
  = negation:negation? key:search_key sep value:numeric_in_list &{
      return tc.predicateFilter(FilterType.NUMERIC_IN, key)
    } {
      return tc.tokenFilter(FilterType.NUMERIC_IN, key, value, opDefault, !!negation);
    }

// numeric comparison filter
numeric_filter
  = negation:negation? key:search_key sep op:operator? value:numeric_value &{
      return tc.predicateFilter(FilterType.NUMERIC, key)
    } {
      return tc.tokenFilter(FilterType.NUMERIC, key, value, op, !!negation);
    }

// aggregate duration filter
aggregate_duration_filter
  = negation:negation? key:aggregate_key sep op:operator? value:duration_format &{
      return tc.predicateFilter(FilterType.AGGREGATE_DURATION, key)
  } {
      return tc.tokenFilter(FilterType.AGGREGATE_DURATION, key, value, op, !!negation);
    }

// aggregate file size filter
aggregate_size_filter
  = negation:negation? key:aggregate_key sep op:operator? value:size_format &{
      return tc.predicateFilter(FilterType.AGGREGATE_SIZE, key)
  } {
      return tc.tokenFilter(FilterType.AGGREGATE_SIZE, key, value, op, !!negation);
    }

// aggregate percentage filter
aggregate_percentage_filter
  = negation:negation? key:aggregate_key sep op:operator? value:percentage_format &{
      return tc.predicateFilter(FilterType.AGGREGATE_PERCENTAGE, key)
    } {
      return tc.tokenFilter(FilterType.AGGREGATE_PERCENTAGE, key, value, op, !!negation);
    }

// aggregate numeric filter
aggregate_numeric_filter
  = negation:negation? key:aggregate_key sep op:operator? value:numeric_value &{
      return tc.predicateFilter(FilterType.AGGREGATE_NUMERIC, key)
    } {
      return tc.tokenFilter(FilterType.AGGREGATE_NUMERIC, key, value, op, !!negation);
    }

// aggregate date filter
aggregate_date_filter
  = negation:negation? key:aggregate_key sep op:operator? value:iso_8601_date_format &{
      return tc.predicateFilter(FilterType.AGGREGATE_DATE, key)
    } {
      return tc.tokenFilter(FilterType.AGGREGATE_DATE, key, value, op, !!negation);
    }

// filter for relative dates
aggregate_rel_date_filter
  = negation:negation? key:aggregate_key sep op:operator? value:rel_date_format &{
      return tc.predicateFilter(FilterType.AGGREGATE_RELATIVE_DATE, key)
    } {
      return tc.tokenFilter(FilterType.AGGREGATE_RELATIVE_DATE, key, value, op, !!negation);
    }

// has filter for not null type checks
has_filter
  = negation:negation? &"has:" key:search_key sep value:(search_key / search_value) &{
      return tc.predicateFilter(FilterType.HAS, key)
    } {
      return tc.tokenFilter(FilterType.HAS, key, value, opDefault, !!negation);
    }

// is filter. Specific to issue search
is_filter
  = negation:negation? &"is:" key:search_key sep value:search_value &{
      return tc.predicateFilter(FilterType.IS, key)
    } {
      return tc.tokenFilter(FilterType.IS, key, value, opDefault, !!negation);
    }

// in filter key:[val1, val2]
text_in_filter
  = negation:negation? key:text_key sep value:text_in_list &{
      return tc.predicateFilter(FilterType.TEXT_IN, key)
    } {
      return tc.tokenFilter(FilterType.TEXT_IN, key, value, opDefault, !!negation);
    }

// standard key:val filter
//
// The text_filter is a little special since it may not have an operator
// depending on the configuration of the search parser, thus we have a
// predicate for the operator.
text_filter
  = negation:negation?
    key:text_key
    sep
    op:(operator &{ return tc.predicateTextOperator(key); })?
    value:search_value &{
      return tc.predicateFilter(FilterType.TEXT, key)
    } {
      return tc.tokenFilter(FilterType.TEXT, key, value, op ? op[0] : opDefault, !!negation);
    }

// Filter keys
key
  = value:[a-zA-Z0-9_.-]+ {
      return tc.tokenKeySimple(value.join(''), false);
    }

quoted_key
  = '"' key:[a-zA-Z0-9_.:-]+ '"' {
      return tc.tokenKeySimple(key.join(''), true);
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
  = arg1:aggregate_param
    args:(spaces comma spaces !comma aggregate_param?)* {
      return tc.tokenKeyAggregateArgs(arg1, args);
    }

aggregate_param
  = quoted_aggregate_param / raw_aggregate_param

raw_aggregate_param
  = param:[^()\t\n, \"]+ {
      return tc.tokenKeyAggregateParam(param.join(''), false);
    }

quoted_aggregate_param
  = '"' param:('\\"' / [^\t\n\"])* '"' {
      return tc.tokenKeyAggregateParam(`"${param.join('')}"`, true);
    }

search_key
  = key / quoted_key

text_key
  = explicit_tag_key / search_key

// Filter values

value
  = value:[^()\t\n ]* {
      return tc.tokenValueText(value.join(''), false);
    }

quoted_value
  = '"' value:('\\"' / [^"])* '"' {
      return tc.tokenValueText(value.join(''), true);
    }

in_value
  = (&in_value_termination in_value_char)+ {
        return tc.tokenValueText(text(), false);
    }

text_in_value
  = quoted_value / in_value

search_value
  = quoted_value / value

numeric_value
  = value:("-"? numeric) unit:[kmb]? &(end_value / comma / closed_bracket) {
      return tc.tokenValueNumber(value.join(''), unit);
    }

boolean_value
  = value:("true"i / "1" / "false"i / "0") &end_value {
      return tc.tokenValueBoolean(value);
    }

text_in_list
  = open_bracket
    item1:text_in_value
    items:(spaces comma spaces !comma text_in_value?)*
    closed_bracket
    &end_value {
      return tc.tokenValueTextList(item1, items);
    }

numeric_in_list
  = open_bracket
    item1:numeric_value
    items:(spaces comma spaces !comma numeric_value?)*
    closed_bracket
    &end_value {
      return tc.tokenValueNumberList(item1, items);
    }

// See: https://stackoverflow.com/a/39617181/790169
in_value_termination
  = in_value_char (!in_value_end in_value_char)* in_value_end

in_value_char
  = [^(), ]

in_value_end
  = closed_bracket / (spaces comma)

// Format values

// XXX: Since pegjs does not support regex there is no easy way to repeat
// groups n times. So we have some dumb tokens here to handle that. We don't do
// this in the backend grammar since we just use regex there.
num2 = [0-9] [0-9]
num4 = [0-9] [0-9] [0-9] [0-9]

date_format = num4 "-" num2 "-" num2
time_format = "T" num2 ":" num2 ":" num2 ("." ms_format)?
ms_format   = [0-9] [0-9]? [0-9]? [0-9]? [0-9]? [0-9]?
tz_format   = [+-] num2 ":" num2

iso_8601_date_format
  = date_format time_format? ("Z" / tz_format)? &end_value {
      return tc.tokenValueIso8601Date(text());
    }

rel_date_format
  = sign:[+-] value:[0-9]+ unit:[wdhm] &end_value {
      return tc.tokenValueRelativeDate(value.join(''), sign, unit);
    }

duration_format
  = value:numeric
    unit:("ms"/"s"/"min"/"m"/"hr"/"h"/"day"/"d"/"wk"/"w")
    &end_value {
      return tc.tokenValueDuration(value, unit);
    }

size_format
  = value:numeric
    unit:("bit"/"nb"/"bytes"/"kb"/"mb"/"gb"/"tb"/"pb"/"eb"/"zb"/"yb"/"kib"/"mib"/"gib"/"tib"/"pib"/"eib"/"zib"/"yib")
    &end_value {
      return tc.tokenValueSize(value, unit);
    }

percentage_format
  = value:numeric "%" {
      return tc.tokenValuePercentage(value);
    }

// NOTE: the order in which these operators are listed matters because for
// example, if < comes before <= it will match that even if the operator is <=
operator       = ">=" / "<=" / ">" / "<" / "=" / "!="
or_operator    = "OR"i  &end_value
and_operator   = "AND"i &end_value
numeric        = [0-9]+ ("." [0-9]*)? { return text(); }
open_paren     = "("
closed_paren   = ")"
open_bracket   = "["
closed_bracket = "]"
sep            = ":"
negation       = "!"
comma          = ","
spaces         = " "* { return tc.tokenSpaces(text()) }

end_value = [\t\n )] / !.
