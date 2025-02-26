import {DeployBadge} from 'sentry/components/core/badge/deployBadge';
import storyBook from 'sentry/stories/storyBook';
import type {Deploy} from 'sentry/types/release';

const deploy: Deploy = {
  name: '85fedddce5a61a58b160fa6b3d6a1a8451e94eb9 to prod',
  url: '',
  environment: 'production',
  dateStarted: '2020-05-11T18:12:00.025928Z',
  dateFinished: '2020-05-11T18:12:00.025928Z',
  version: '4.2.0',
  id: '6348842',
};

export default storyBook('DeployBadge', story => {
  story('Renders with a link', () => (
    <DeployBadge deploy={deploy} orgSlug="sentry" version="1.2.3" projectId={1} />
  ));
});
