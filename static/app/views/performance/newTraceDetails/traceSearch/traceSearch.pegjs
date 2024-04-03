{
    function as_undefined(){
        return undefined;
    }

    function as_null(){
        return null;
    }

    function as_operator_type(input){
        switch(input){
            case ">=":
                return "ge";
            case "<=":
                return "le";
            case "=":
                return "eq";
            case "<":
                return "lt";
            case ">":
                return "gt";
        }
    }

    function as_bool(input){
        switch(input){
        case "true": return true;
        case "false": return false;
        default: {
            throw new Error("Failed to parse boolean value")
            }
        }
    }
}

search_grammar
   = t:token* {
        return t
   }

token = search

search = s:search_key separator vo:value_operator? v:value {
    return {
        type: "Token",
        key: s.value,
        value: v,
        ...(s.negated ? {negated: true}: {}),
        ...(vo ? {operator: vo} : {}),
    }
}


search_key = space n:[!]? k:value space {
    return {
        value: k,
        ...(!!n ? {negated: true} : {}),
    }
}
value = space k:(bool/undefined/null/float/integer/string) space { return k }

value_operator = space k:(">=" / "<=" / "=" / "<" / ">") space {
    return as_operator_type(text())
}

// Primitives
bool = k:("true" / "false") { return as_bool(text()) }
undefined = "undefined" { return as_undefined() }
null = "null" { return as_null() }
float = ([-])? ([0-9]+)? "." ([0-9]+)? !string {
    return parseFloat(text(), 10)
}
integer = ([-])?[0-9]+ !string{
    return parseInt(text(), 10)
}
string = [a-zA-Z0-9\-._!$]+ !bool !undefined !null {
    return text()
}

space = " "*
separator = ":"
eoi = [\t\n]
