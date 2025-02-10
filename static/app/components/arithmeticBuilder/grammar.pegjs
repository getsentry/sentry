{
  const {tc, term} = options;
}

tokens = token*

token
  = spaces token:(paren / op / func / free_text) spaces {
    return token;
  }

func
  = func:func_name "(" spaces attr:attr spaces ")" {
    return tc.tokenFunction(func, attr, location());
  }

attr = typed_attr / untyped_attr

typed_attr
  = "tags[" name:attr_name "," spaces type:type_name "]" {
    return tc.tokenAttribute(name, type, location());
  }

untyped_attr
  = name:attr_name {
    return tc.tokenAttribute(name, undefined, location());
  }

free_text
  = str:(typed_attr_string / typed_attr_string_or_func_string) {
    return tc.tokenFreeText(text(), location());
  }

typed_attr_string_or_func_string
  // TODO: explain why we use the `untyped_attr_string` pattern for `func` here
  = func_string:untyped_attr_string ("(" (spaces attr_string:(typed_attr_string / untyped_attr_string) (spaces ")")?)?)? {
    return text();
  }

typed_attr_string
  = "t" ("a" ("g" ("s" ("[" (name:attr_name ("," (spaces type:type_name ("]")?)?)?)?)?)?)?)? {
    return text();
  }

untyped_attr_string
  = name:attr_name {
    return text();
  }

func_name
  = [a-zA-Z0-9_]+ {
    return text();
  }

attr_name
  = [^()\t\n, \"]+ {
    return text();
  }

type_name
  = [a-z]+ {
    return text();
  }

op = plus / minus / multiply / divide

plus
  = "+" {
    return tc.tokenOperator('+', location());
  }
minus
  = "-" {
    return tc.tokenOperator('-', location());
  }
multiply
  = "*" {
    return tc.tokenOperator('*', location());
  }
divide
  = [/÷] {
    return tc.tokenOperator('/', location());
  }

paren = open_paren / close_paren

open_paren
  = "(" {
    return tc.tokenParenthesis('(', location());
  }

close_paren
  = ")" {
    return tc.tokenParenthesis(')', location());
  }

spaces      = " "*
