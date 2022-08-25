import styled from '@emotion/styled';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {CodecovRepo} from 'sentry/utils/replays/codecovRepo';
import ModuleTable from 'sentry/views/replays/detail/unusedModules/moduleTable';
import UrlSummary from 'sentry/views/replays/detail/unusedModules/urlSummary';
import type {ReplayRecord} from 'sentry/views/replays/types';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

type Props = {
  codecovRepo: CodecovRepo;
  replayRecord: ReplayRecord;
};

function UnusedModules({codecovRepo, replayRecord: _0}: Props) {
  const {currentTime: _2, replay} = useReplayContext();
  if (!replay) {
    return null;
  }

  const isEmpty = codecovRepo.urls.length === 0;

  if (isEmpty) {
    return <EmptyMessage>{t('No import data available for current URL')}</EmptyMessage>;
  }

  return (
    <PageList>
      {codecovRepo.urls.map(url => {
        const unusedModules = codecovRepo.getUnusedModulesByUrl(url);
        const usedModules = codecovRepo.getUsedModulesByUrl(url);
        return (
          <ListItem key={url}>
            <UrlSummary
              usedModules={usedModules}
              unusedModules={unusedModules}
              url={url}
            />
            <ModuleTable
              emptyMessage={t('No access data available')}
              modules={unusedModules}
              title={t('Unused Modules')}
            />
            <ModuleTable
              emptyMessage={t('No access data available')}
              modules={usedModules}
              title={t('Accessed Modules')}
            />
          </ListItem>
        );
      })}
    </PageList>
  );
}

const PageList = styled('ul')`
  list-style: none;
  padding: 0;
  margin-bottom: 0;
`;

const ListItem = styled('li')`
  margin-bottom: ${space(2)};
`;

export default UnusedModules;
