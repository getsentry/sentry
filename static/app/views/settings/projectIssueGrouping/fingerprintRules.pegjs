// The grammar in src/sentry/grouping/fingerprinting/parser.py, returning highlight tokens.
// A line that doesn't parse becomes a single `invalid` token instead of failing the parse.

{{
  const VARIABLES = /\{\{\s*\S+\s*\}\}/g;
  const WHOLE_VARIABLE = /^\{\{\s*\S+\s*\}\}$/;
}}

{
  const token = (type, {start, end} = range()) => ({type, start, end});

  // A quoted attribute value, with any variables in it highlighted
  function template({start, end}) {
    const tokens = [];
    let pos = start;
    for (const match of input.slice(start, end).matchAll(VARIABLES)) {
      const variableStart = start + match.index;
      if (variableStart > pos) {
        tokens.push(token('string', {start: pos, end: variableStart}));
      }
      pos = variableStart + match[0].length;
      tokens.push(token('variable', {start: variableStart, end: pos}));
    }
    if (pos < end) {
      tokens.push(token('string', {start: pos, end}));
    }
    return tokens;
  }
}

fingerprinting_rules = first:line rest:(newline @line)* { return [first, ...rest].flat(); }

line = rule_line / comment_line / blank_line / invalid_line

rule_line = @rule &line_end

comment_line = _ @comment &line_end

blank_line = _ &line_end { return []; }

invalid_line = _ @([^\r\n]+ { return token('invalid'); })

rule = _ matchers:matcher+ _ arrow:follow _ fingerprint:fp_value+ {
    return [...matchers.flat(), arrow, ...fingerprint.flat()];
  }

matcher = _ negation:negation? type:matcher_type sep:sep argument:argument {
    return negation ? [negation, type, sep, argument] : [type, sep, argument];
  }

matcher_type = (key / quoted_key) { return token('matcher'); }

argument = (quoted / unquoted) { return token('pattern'); }

fp_value = _ argument:fp_argument _ comma:comma? {
    return comma ? [...argument, comma] : argument;
  }

fp_argument = fp_attribute / fp_quoted / fp_unquoted

fp_attribute = key:(key { return token('attribute'); }) equals:equals value:(quoted { return range(); }) {
    return [key, equals, ...template(value)];
  }

fp_quoted = quoted {
    return [token(WHOLE_VARIABLE.test(text().slice(1, -1)) ? 'variable' : 'value')];
  }

fp_unquoted = variable / (!whitespace [^{,])+ { return [token('value')]; }

// Ends at the first `}}`. The backend's regex backtracks to the last `}}` in the word, so it
// also accepts oddities like `{{}}}}` or `{{a}}{b}}`, which get a false error here.
variable = "{{" whitespace* (!"}}" !whitespace .)+ whitespace* "}}" { return [token('variable')]; }

key = [a-zA-Z0-9_.-]+

quoted_key = '"' [a-zA-Z0-9_.:-]+ '"'

quoted = '"' ([^"\\] / "\\" [^\n])* '"'

unquoted = (!whitespace .)+

comment = "#" [^\r\n]* { return token('comment'); }

follow = "->" { return token('arrow'); }

sep = ":" { return token('punctuation'); }

equals = "=" { return token('punctuation'); }

comma = "," { return token('punctuation'); }

negation = "!" { return token('negation'); }

whitespace = char:. &{ return /\s/.test(char); }

newline = [\r\n]

line_end = newline / !.

_ = " "*
