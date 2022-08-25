import styled from '@emotion/styled';

import BreadcrumbIcon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import {CodecovRepo} from 'sentry/utils/replays/codecovRepo';
import MetaTable from 'sentry/views/replays/detail/unusedModules/metaTable';
import ModuleTable from 'sentry/views/replays/detail/unusedModules/moduleTable';
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
            <Title>
              <IconWrapper color="green300">
                <BreadcrumbIcon type={BreadcrumbType.NAVIGATION} />
              </IconWrapper>{' '}
              <Text>{new URL(url).pathname}</Text>
            </Title>
            <Indent>
              <MetaTable usedModules={usedModules} unusedModules={unusedModules} />
              <ModuleTable
                emptyMessage={t('No access data available')}
                unusedModules={unusedModules}
                usedModules={usedModules}
              />
            </Indent>
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

const Indent = styled('div')`
  padding-left: ${space(4)};
`;

const ListItem = styled('li')`
  margin-bottom: ${space(2)};
`;

const Title = styled('div')`
  position: sticky;
  top: 0;
  z-index: 1;
  background: ${p => p.theme.white};
  font-size: ${p => p.theme.text.cardTitle.fontSize};
  font-weight: ${p => p.theme.text.cardTitle.fontWeight};
  line-height: ${p => p.theme.text.cardTitle.lineHeight};
  display: grid;
  gap: 8px;
  grid-template-columns: max-content 1fr;
`;

const Text = styled('div')`
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
`;

const IconWrapper = styled('div')<Required<Pick<SVGIconProps, 'color'>>>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: ${p => p.theme.white};
  background: ${p => p.theme[p.color] ?? p.color};
  box-shadow: ${p => p.theme.dropShadowLightest};
  z-index: 1;
`;

export default UnusedModules;
