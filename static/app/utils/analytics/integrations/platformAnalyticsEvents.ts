import {IntegrationView} from './index';

export enum PlatformEvents {
  DOCS = 'integrations.platform_docs_clicked',
  EXAMPLE_SOURCE = 'integrations.platform_example_source_clicked',
  OPEN_CREATE_MODAL = 'integrations.platform_open_create_modal',
  CHOSE_INTERNAL = 'integrations.platform_create_modal_internal_clicked',
  INTERNAL_DOCS = 'integrations.platform_internal_docs_clicked',
  CHOSE_PUBLIC = 'integrations.platform_create_modal_public_clicked',
  PUBLIC_DOCS = 'integrations.platform_public_docs_clicked',
  CHOSE_SENTRY_FX = 'integrations.platform_create_modal_sentry_fx_clicked',
}

export type PlatformEventParameters = {
  [key in PlatformEvents]: {} & IntegrationView;
};

export const platformEventMap: Record<PlatformEvents, string> = {
  [PlatformEvents.DOCS]: 'Integrations: Platform Example App Docs Clicked',
  [PlatformEvents.EXAMPLE_SOURCE]:
    'Integrations: Platform Example App Source Code Clicked',
  [PlatformEvents.OPEN_CREATE_MODAL]:
    'Integrations: Platform Open Create Integration Modal',
  [PlatformEvents.CHOSE_INTERNAL]: 'Integrations: Platform Chose Internal Integration',
  [PlatformEvents.INTERNAL_DOCS]:
    'Integrations: Platform Internal Integration Docs Clicked',
  [PlatformEvents.CHOSE_PUBLIC]: 'Integrations: Platform Chose Public Integration',
  [PlatformEvents.PUBLIC_DOCS]: 'Integrations: Platform Public Integration Docs Clicked',
  [PlatformEvents.CHOSE_SENTRY_FX]: 'Integrations: Platform Chose Sentry FX',
};

export const platformEventLinkMap: Partial<Record<PlatformEvents, string>> = {
  [PlatformEvents.DOCS]:
    'https://docs.sentry.io/product/integrations/integration-platform/',
  [PlatformEvents.EXAMPLE_SOURCE]:
    'https://github.com/getsentry/integration-platform-example/',
  [PlatformEvents.INTERNAL_DOCS]:
    'https://docs.sentry.io/product/integrations/integration-platform/internal-integration/',
  [PlatformEvents.PUBLIC_DOCS]:
    'https://docs.sentry.io/product/integrations/integration-platform/public-integration/',
};
