{
  const {tc, term} = options;
}

tokens = token*

token
  = spaces token:(paren / literal / op / func / free_text) spaces {
    return token;
  }

func
  = func:name "(" args:args spaces ")" {
    return tc.tokenFunction(func, args, location());
  }

args = arg_list / no_arg

no_arg
  = spaces {
    return [];
  }

arg_list
  = head:yes_arg tail:("," @yes_arg)* { return [head, ...tail]; }

yes_arg
  = spaces arg:arg spaces { return arg }

arg = attr

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

literal
  = [+-]?[0-9]+ ("." [0-9]*)? {
    return tc.tokenLiteral(text(), location());
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
