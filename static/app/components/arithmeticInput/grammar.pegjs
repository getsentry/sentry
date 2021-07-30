{
  const {tc, term} = options;
}

term
  = maybeFactor:maybe_factor remainingAdds:remaining_adds {
    return tc.tokenTerm(maybeFactor, remainingAdds);
  }

remaining_adds = add_sub*

add_sub
  = operator:add_sub_operator rhs:maybe_factor {
    return tc.tokenOperation(operator, rhs);
  }

maybe_factor
  = spaces term:(factor / primary) spaces {
    return term;
  }

factor
  = primary:primary remaining:remaining_muls {
    return tc.tokenFactor(primary, remaining);
  }

remaining_muls = mul_div+

mul_div
  = operator:mul_div_operator rhs:primary {
    return tc.tokenOperation(operator, rhs);
  }

add_sub_operator
  = spaces operator:(plus / minus) spaces {
    return operator;
  }

mul_div_operator
  = spaces operator:(multiply / divide) spaces {
    return operator;
  }

primary
  = spaces primary:(parens / numeric_value / function_value / field_value) spaces {
    return primary;
  }

parens
  = open_paren term:term closed_paren {
    return term;
  }

plus
  = "+" {
    return "plus";
  }
minus
  = "-" {
    return "minus";
  }
multiply
  = "*" {
    return "multiply";
  }
divide
  = [/÷] {
    return "divide";
  }

function_value "function"
  = function_name open_paren spaces function_args? spaces closed_paren {
    return tc.tokenFunction(text(), location());
  }
numeric_value "number"
  = [+-]?[0-9]+ ("." [0-9]*)? {
    return text();
  }
field_value "field"
  = [a-zA-Z_\.]+ {
    return tc.tokenField(text(), location());
  }

function_args
  = aggregate_param (spaces comma spaces aggregate_param)*

aggregate_param
  = quoted_aggregate_param / raw_aggregate_param

raw_aggregate_param
  = param:[^()\t\n, \"]+

quoted_aggregate_param
  = '"' param:('\\"' / [^\t\n\"])* '"'

function_name        = [a-zA-Z_0-9]+
comma                = ","
open_paren           = "("
closed_paren         = ")"
spaces               = " "*
