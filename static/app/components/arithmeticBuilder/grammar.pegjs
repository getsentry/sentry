{
  const {tc, term} = options;
}

tokens = token*

token
  = spaces token:(paren / op / func / free_text) spaces {
    return token;
  }

func
  = func:name "(" spaces attr:attr spaces ")" {
    return tc.tokenFunction(func, attr, location());
  }

attr = typed_attr / untyped_attr

typed_attr
  = "tags[" name:name "," spaces type:type_name "]" {
    return tc.tokenAttribute(name, type, location());
  }

untyped_attr
  = name:name {
    return tc.tokenAttribute(name, undefined, location());
  }

free_text = typed_attr_string / untyped_attr_string_or_func_string / string

string
  = [^ ]+ {
    return tc.tokenFreeText(text(), location());
  }

untyped_attr_string_or_func_string
  = name ("(" (spaces (typed_attr_string / untyped_attr_string) (spaces ")")?)?)? {
    return tc.tokenFreeText(text(), location());
  }

typed_attr_string
  = "t" ("a" ("g" ("s" ("[" (name ("," (spaces type_name ("]")?)?)?)?)?)?)?)? {
    return tc.tokenFreeText(text(), location());
  }

untyped_attr_string
  = name:name {
    return text();
  }

name
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
