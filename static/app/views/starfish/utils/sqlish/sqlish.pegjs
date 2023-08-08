Expression
   = tokens:Token*

Token
  = LeftParenthesis / RightParenthesis / Whitespace / Keyword / Parameter / CollapsedColumns / GenericToken

LeftParenthesis
  = "(" { return { type: 'LeftParenthesis', content: '(' } }

RightParenthesis
  = ")" { return { type: 'RightParenthesis', content: ')' } }

Keyword
  = Keyword:("SELECT"i / "INSERT"i / "DELETE"i / "FROM"i / "ON"i / "WHERE"i / "AND"i / "ORDER BY"i / "LIMIT"i / "GROUP BY"i / "OFFSET"i / "VALUES"i / "RETURNING"i / JoinKeyword) {
  return { type: 'Keyword', content: Keyword }
}

JoinKeyword
  = JoinDirection:JoinDirection? Whitespace? JoinType:JoinType? Whitespace "JOIN"i {
  return (JoinDirection || '') + (JoinDirection ? " " : '') + JoinType + " " + "JOIN"
}

JoinDirection
  = "LEFT"i / "RIGHT"i / "FULL"i

JoinType
  = "OUTER"i / "INNER"i

Parameter
  = Parameter:("%s" / ":c" [0-9]) { return { type: 'Parameter', content: Array.isArray(Parameter) ? Parameter.join('') : Parameter } }

CollapsedColumns
  = ".." { return { type: 'CollapsedColumns', content: '..' } }

Whitespace
  = Whitespace:[\n\t ]+ { return { type: 'Whitespace', content: Whitespace.join("") } }

GenericToken
  = GenericToken:[a-zA-Z0-9"'`_\-.=><:,*;!\[\]?$%|/]+ { return { type: 'GenericToken', content: GenericToken.join('') } }
