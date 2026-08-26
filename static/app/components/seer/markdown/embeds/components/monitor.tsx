import {lazy} from 'react';

import {Container} from '@sentry/scraps/layout';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {LazyLoad} from 'sentry/components/lazyLoad';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {IconTimer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';

const LazyGroupList = lazy(async () => {
  const {GroupList} = await import('sentry/components/issues/groupList');
  return {default: GroupList};
});

function MonitorLink({id, name}: EmbedOutput<'monitor'>) {
  const organization = useOrganization();
  const href = makeMonitorDetailsPathname(organization.slug, id);

  return (
    <ResourceLink icon={IconTimer} href={href} title={name ?? t('Monitor %s', id)} />
  );
}

function MonitorBlock({id, name, statsPeriod}: EmbedOutput<'monitor'>) {
  const organization = useOrganization();
  const href = makeMonitorDetailsPathname(organization.slug, id);

  return (
    <Container
      background="primary"
      border="primary"
      radius="md"
      padding="md"
      overflow="hidden"
    >
      <ResourceLink icon={IconTimer} href={href} title={name ?? t('Monitor %s', id)} />
      <ErrorBoundary mini>
        <LazyLoad
          LazyComponent={LazyGroupList}
          queryParams={{
            query: `is:unresolved detector:${id}`,
            statsPeriod: statsPeriod ?? '24h',
            limit: 5,
          }}
          numPlaceholderRows={3}
          withChart={false}
          withColumns={[]}
          withHeader={false}
          withPagination={false}
          canSelectGroups={false}
          useFilteredStats={false}
        />
      </ErrorBoundary>
    </Container>
  );
}

export const Monitor = defineSeerEmbed({
  name: 'monitor',
  render(props, level) {
    if (level === 'block') {
      return <MonitorBlock {...props} />;
    }
    return <MonitorLink {...props} />;
  },
});
