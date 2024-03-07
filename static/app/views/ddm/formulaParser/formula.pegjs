
expression = term (_ expr_op _ term)*
expr_op = plus / minus

term = unary (_ term_op _ unary)*
term_op = multiply / divide
unary = minus? coefficient
coefficient = number / variable / open_paren _ expression _ close_paren



number              = '-'?[0-9]+('.'[0-9]+)? { return { type: "number", content: text()}}
variable            = [a-z]+ { return { type: "variable", content: text()}}
_                   = " "* { return { type: "whitespace", content: text()}}

open_paren          = "(" { return { type: "openParen", content: text()}}
close_paren         = ")" { return { type: "closeParen", content: text()}}
plus                = "+" { return { type: "plus", content: text()}}
minus               = "-" { return { type: "minus", content: text()}}
multiply            = "*" { return { type: "multiply", content: text()}}
divide              = "/" { return { type: "divide", content: text()}}
