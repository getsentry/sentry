{
    function as_number(value, exponent){
        if(exponent !== undefined){
            return value * Math.pow(10, exponent)
        }
        return value;
    }

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

    function as_milliseconds(ms, unit){
        switch(unit){
            case "ms":
                ms = ms;
                break
            case "s":
                ms = ms * 1e3;
                break
            case "min":
            case "m":
                ms = ms * 1e3 * 60;
                break
            case "hr":
            case "h":
                ms = ms * 1e3 * 60 * 60;
                break
            case "day":
            case "d":
                ms = ms * 1e3 * 60 * 60 * 24;
                break
            case "wk":
            case "w":
                ms = ms * 1e3 * 60 * 60 * 24 * 7;
                break
            default:
                throw new Error("Failed to parse duration value")
        }
        return ms;
    }
}

search_grammar
   = t:token* &eoi{
        return t
   }

token = search

search = s:search_key separator vo:value_operator? v:value {
    return {
        type: "token",
        key: s.value,
        value: v,
        ...(s.negated ? {negated: true}: {}),
        ...(vo ? {operator: vo} : {}),
    }
}

search_key = space n:[!]? k:string space {
    return {
        value: k,
        ...(!!n ? {negated: true} : {}),
    }
}

value = space k:(bool/undefined/null/numeric/string/empty) space { return k }
value_operator = space k:(">=" / "<=" / "=" / "<" / ">") space {
    return as_operator_type(text())
}

// Primitives
bool = k:("true" / "false") { return as_bool(text()) }
undefined = "undefined" { return as_undefined() }
null = "null" { return as_null() }

empty = "" { return "" }

float = ([-])? ([0-9]+)? "." ([0-9]+)? e:exponent? &token_end {
    return as_number(parseFloat(text(), 10), e)
}

integer = ([-])?[0-9]+ e:exponent? &token_end {
    return as_number(parseInt(text(), 10), e)
}

numeric = duration / float / integer
duration_value = ([-])?[0-9]+ ("." [0-9]*)? e:exponent? {
    return as_number(parseFloat(text(), 10), e);
}

exponent = [eE] sign:[-+]? v:[0-9]+ {
    var value = parseInt(v, 10)
    return sign === "-" ? -value : value
}

duration = value:duration_value space unit:("ms"/"s"/"min"/"m"/"hr"/"h"/"day"/"d"/"wk"/"w") &token_end {
    return as_milliseconds(value, unit)
}
free_text = [a-zA-Z0-9\-._!$]+ {
    return text()
}
string = duration / free_text;

space = " "*
token_end = " "+ / eoi
separator = ":"
eoi = [\t\n] / !.
