export const grammar = `
#JSGF V1.0;
grammar sentryGrammar;

public <phrase> = <navigationCommand>;

// Navigation commands
<navigationCommand> = go to <pageName> page;
<pageName> = settings | issues | billing | DSN | apdex;

// Action commands
// e.g. Select issues, resolve issues, etc.
`;
