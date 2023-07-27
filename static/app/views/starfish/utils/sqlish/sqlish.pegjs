Expression
   = tokens:Token*

Token
   = Keyword / Wildcard / Parameter / CollapsedColumns / Semicolon / Whitespace / GenericToken

Keyword
  = Keyword:("SELECT"i / "INSERT"i / "DELETE"i / "FROM"i / "ON"i / "WHERE"i / "AND"i / JoinKeyword) {
  return { type: 'Keyword', content: Keyword }
}

JoinKeyword
  = JoinDirection:JoinDirection? Whitespace JoinType:JoinType? Whitespace "JOIN"i {
  return (JoinDirection || '') + (JoinDirection ? " " : '') + JoinType + " " + "JOIN"
}

JoinDirection
 = "LEFT"i / "RIGHT"i / "FULL"i

JoinType
= "OUTER"i / "INNER"i

Wildcard
= "*" { return { type: 'Wildcard', content: "*" } }

Parameter
  = "%s" { return { type: 'Parameter', content: "%s" } }

CollapsedColumns
  = ".." { return { type: 'CollapsedColumns' } }

Semicolon
  = ";" { return { type: 'Semicolon', content: ";" } }

Whitespace
  = Whitespace:[\n\t ]+ { return { type: 'Whitespace', content: Whitespace.join("") } }

GenericToken
  = GenericToken:[a-zA-Z0-9"'_.()=]+ { return { type: 'GenericToken', content: GenericToken.join('') } }
