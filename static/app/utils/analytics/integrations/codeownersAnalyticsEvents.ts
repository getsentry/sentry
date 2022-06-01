import {IntegrationView} from './index';

export enum CodeownersEvents {
  'integrations.code_owners_cta_setup_clicked' = 'Integrations: Code Owners CTA Setup Clicked',
  'integrations.code_owners_cta_docs_clicked' = 'Integrations: Code Owners CTA Setup Clicked',
  'integrations.show_code_owners_prompt' = 'Integrations: Show Code Owners Prompt',
  'integrations.dismissed_code_owners_prompt' = 'Integrations: Dismissed Code Owners Prompt',
}

type CodeownersEventParams = {
  project_id: string;
} & IntegrationView;

export type CodeownersEventParameters = {
  [key in keyof typeof CodeownersEvents]: CodeownersEventParams;
};
