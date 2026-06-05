import type {Plugin} from 'sentry/types/integrationsBase';

export type TitledPlugin = Plugin & {
  // issue serializer adds more fields
  // TODO: should be able to use name instead of title
  title: string;
};
