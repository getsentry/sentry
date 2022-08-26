import {recognitionCommands} from './commands';

export const getGrammar = (): string => {
  const rules = recognitionCommands.map(command => command.jsgfRule()).join(' ');
  return `
#JSGF V1.0;
grammar sentryGrammar;
${rules}`;
};
