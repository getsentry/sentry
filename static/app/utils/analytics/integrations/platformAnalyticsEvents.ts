import {IntegrationView} from './index';

export enum PlatformEvents {
  EXAMPLE_DOCS = 'integrations.platform_example_docs_clicked',
  EXAMPLE_SOURCE = 'integrations.platform_example_source_clicked',
  OPEN_CREATE_MODAL = 'integrations.platform_open_create_modal',
  CHOSE_INTERNAL = 'integrations.platform_create_modal_internal_clicked',
  INTERNAL_DOCS = 'integrations.platform_internal_docs_clicked',
  CHOSE_PUBLIC = 'integrations.platform_create_modal_public_clicked',
  PUBLIC_DOCS = 'integrations.platform_public_docs_clicked',
}

export type PlatformEventParameters = {
  [key in PlatformEvents]: {} & IntegrationView;
};

export const platformEventMap: Record<PlatformEvents, string> = {
  [PlatformEvents.EXAMPLE_DOCS]: 'Integrations: Platform Example App Docs Clicked',
  [PlatformEvents.EXAMPLE_SOURCE]:
    'Integrations: Platform Example App Source Code Clicked',
  [PlatformEvents.OPEN_CREATE_MODAL]:
    'Integrations: Platform Open Create Integration Modal',
  [PlatformEvents.CHOSE_INTERNAL]: 'Integrations: Platform Chose Internal Integration',
  [PlatformEvents.INTERNAL_DOCS]:
    'Integrations: Platform Internal Integration Docs Clicked',
  [PlatformEvents.CHOSE_PUBLIC]: 'Integrations: Platform Chose Public Integration',
  [PlatformEvents.PUBLIC_DOCS]: 'Integrations: Platform Public Integration Docs Clicked',
};
