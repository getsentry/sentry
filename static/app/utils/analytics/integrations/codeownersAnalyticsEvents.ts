import {IntegrationView} from './index';

export enum CodeownersEvents {
  SETUP_CTA = 'integrations.code_owners_cta_setup_clicked',
  DOCS_CTA = 'integrations.code_owners_cta_docs_clicked',
  SHOW_PROMPT = 'integrations.show_code_owners_prompt',
  DISMISS_PROMPT = 'integrations.dismissed_code_owners_prompt',
}
// This type allows analytics functions to use the string literal or enum.KEY
type CodeownersEventsLiterals = `${CodeownersEvents}`;

export type CodeownersEventParameters = {
  [key in CodeownersEventsLiterals]: {project_id: string} & IntegrationView;
};

export const codeownersEventMap: Record<CodeownersEventsLiterals, string> = {
  [CodeownersEvents.SETUP_CTA]: 'Integrations: Code Owners CTA Setup Clicked',
  [CodeownersEvents.DOCS_CTA]: 'Integrations: Code Owners CTA Docs Clicked', // Reference in PR!,
  [CodeownersEvents.SHOW_PROMPT]: 'Integrations: Show Code Owners Prompt',
  [CodeownersEvents.DISMISS_PROMPT]: 'Integrations: Dismissed Code Owners Prompt',
};
