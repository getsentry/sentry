Expression
   = tokens:Token*

Token
  = LeftParenthesis / RightParenthesis / Whitespace / Keyword / Parameter / CollapsedColumns / GenericToken

LeftParenthesis
  = "(" { return { type: 'LeftParenthesis', content: '(' } }

RightParenthesis
  = ")" { return { type: 'RightParenthesis', content: ')' } }

Keyword
  = Keyword:("ADD"i / "ALL"i / "ALTER"i / "AND"i / "ANY"i / "AS"i / "ASC"i / "BACKUP"i / "BETWEEN"i / "BY"i / "CASE"i / "CHECK"i / "COLUMN"i / "CONSTRAINT"i / "COUNT"i / "CREATE"i / "DATABASE"i / "DEFAULT"i / "DELETE"i / "DESC"i / "DISTINCT"i / "DROP"i / "EXEC"i / "EXISTS"i / "FOREIGN"i / "FROM"i / "FROM"i / "FULL"i / "GROUP"i / "HAVING"i / "INNER"i / "INSERT"i / "JOIN"i / "KEY"i / "LEFT"i / "LIMIT"i / "OFFSET"i / "ON"i / "ORDER"i / "OUTER"i / "RETURNING"i / "RIGHT"i / "SELECT"i / "SELECT"i / "SET"i / "TABLE"i / "UPDATE"i / "VALUES"i / "WHERE"i / JoinKeyword) & (Whitespace / LeftParenthesis / RightParenthesis) {
  return { type: 'Keyword', content: Keyword.toUpperCase() }
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
  = Whitespace:[\n\t\r ]+ { return { type: 'Whitespace', content: Whitespace.join("") } }

// \u00A0-\uFFFF is the entire Unicode BMP _including_ surrogate pairs and
// unassigned code points, which aren't parse-able naively. A more precise
// approach would be to define all valid Unicode ranges exactly but for
// permissive parsing we don't mind the lack of precision.
GenericToken
  = GenericToken:[a-zA-Z0-9\u00A0-\uFFFF"'`_\-.=><:,*;!\[\]?$%|/\\@#&~^+{}]+ { return { type: 'GenericToken', content: GenericToken.join('') } }
