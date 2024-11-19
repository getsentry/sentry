import type {Deploy} from 'sentry/types/release';

export function DeployFixture(params?: Partial<Deploy>): Deploy {
  return {
    id: '6348842',
    version: '4.2.0',
    name: '85fedddce5a61a58b160fa6b3d6a1a8451e94eb9 to prod',
    url: '',
    environment: 'production',
    dateStarted: '2020-05-11T18:12:00.025928Z',
    dateFinished: '2020-05-11T18:12:00.025928Z',
    ...params,
  };
}
