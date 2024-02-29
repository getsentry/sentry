expression = token*
token = number / variable / _ / open_paren / close_paren / plus / minus / multiply / divide / generic_token


number              = [0-9]+('.'[0-9]+)? { return { type: "number", content: text()}}
variable            = [a-z]+ { return { type: "variable", content: text()}}
_                   = " "+ { return { type: "whitespace", content: text()}}

open_paren          = "(" { return { type: "openParen", content: text()}}
close_paren         = ")" { return { type: "closeParen", content: text()}}
plus                = "+" { return { type: "plus", content: text()}}
minus               = "-" { return { type: "minus", content: text()}}
multiply            = "*" { return { type: "multiply", content: text()}}
divide              = "/" { return { type: "divide", content: text()}}

// \u00A0-\uFFFF is the entire Unicode BMP _including_ surrogate pairs and
// unassigned code points, which aren't parse-able naively. A more precise
// approach would be to define all valid Unicode ranges exactly but for
// permissive parsing we don't mind the lack of precision.
generic_token
  = [a-zA-Z0-9\u00A0-\uFFFF"'`_\-.=><:,*;!\[\]?$%|/\\@#&~^+{}]+ { return { type: 'generic', content: text() } }
