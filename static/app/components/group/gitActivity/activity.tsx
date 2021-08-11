import {Fragment} from 'react';
import styled from '@emotion/styled';

import MenuItemActionLink from 'app/components/actions/menuItemActionLink';
import DropdownLink from 'app/components/dropdownLink';
import ExternalLink from 'app/components/links/externalLink';
import Tooltip from 'app/components/tooltip';
import {IconEllipsis} from 'app/icons/iconEllipsis';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

import Status from './status';

// https://docs.github.com/en/rest/reference/pulls
type GitActivity = React.ComponentProps<typeof Status> & {
  id: string;
  url: string;
  title: string;
  type: 'branch' | 'pull_request';
  author: string;
};

type Props = GitActivity & {
  onUnlink: (id: string) => Promise<void>;
};

function Activity({id, url, title, type, state, author, onUnlink}: Props) {
  return (
    <Fragment>
      <StatusColumn>
        <Status state={state} />
      </StatusColumn>
      <ActivityColumn>
        <Tooltip title={title} containerDisplayMode="inline-flex">
          <StyledExternalLink href={url}>{title}</StyledExternalLink>
        </Tooltip>
        <Author>
          <strong>
            {t('Author')}
            {': '}
          </strong>
          {author}
        </Author>
      </ActivityColumn>
      <ActionsColumn>
        <DropdownLink
          caret={false}
          customTitle={
            <Tooltip title={t('Actions')}>
              <VerticalEllipsisIcon />
            </Tooltip>
          }
          anchorRight
        >
          {type === 'pull_request' && (
            <Fragment>
              {state === 'open' && (
                <MenuItemActionLink
                  onAction={() => onUnlink(id)}
                  title={t('Merge Pull Request')}
                >
                  {t('Merge Pull Request')}
                </MenuItemActionLink>
              )}
              {(state === 'open' || state === 'draft') && (
                <MenuItemActionLink
                  onAction={() => {}}
                  message={t('Are you sure you want to close this Pull Request?')}
                  title={t('Close Pull Request')}
                  shouldConfirm
                >
                  {t('Close Pull Request')}
                </MenuItemActionLink>
              )}
              {state === 'open' && (
                <MenuItemActionLink onAction={() => {}} title={t('Revert to Draft')}>
                  {t('Revert to Draft')}
                </MenuItemActionLink>
              )}
              {state === 'closed' && (
                <MenuItemActionLink onAction={() => {}} title={t('Reopen Pull Request')}>
                  {t('Reopen Pull Request')}
                </MenuItemActionLink>
              )}
              {state === 'draft' && (
                <MenuItemActionLink
                  onAction={() => onUnlink(id)}
                  title={t('Ready for Review')}
                >
                  {t('Ready for Review')}
                </MenuItemActionLink>
              )}
              <MenuItemActionLink
                onAction={() => onUnlink(id)}
                message={t(
                  'Are you sure you want to unlink this Pull Request from the issue?'
                )}
                title={t('Unlink Pull Request')}
                shouldConfirm
              >
                {t('Unlink Pull Request')}
              </MenuItemActionLink>
            </Fragment>
          )}
          {type === 'branch' && (
            <Fragment>
              <MenuItemActionLink onAction={() => {}} title={t('Open Pull Request')}>
                {t('Open Pull Request')}
              </MenuItemActionLink>
              <MenuItemActionLink
                onAction={() => {}}
                message={t('Are you sure you want to delete this Branch?')}
                title={t('Delete Branch')}
                shouldConfirm
              >
                {t('Delete Branch')}
              </MenuItemActionLink>
              <MenuItemActionLink
                onAction={() => onUnlink(id)}
                message={t('Are you sure you want to unlink this Branch from the issue?')}
                title={t('Unlink Branch')}
                shouldConfirm
              >
                {t('Unlink Branch')}
              </MenuItemActionLink>
            </Fragment>
          )}
        </DropdownLink>
      </ActionsColumn>
    </Fragment>
  );
}

export default Activity;

const Column = styled('div')`
  padding: ${space(1)} 0;
  height: 100%;
  line-height: 20px;
`;

const StatusColumn = styled(Column)`
  padding-right: ${space(1.5)};
  padding-left: ${space(0.5)};
`;

const ActivityColumn = styled(Column)`
  word-break: break-all;
  overflow: hidden;
`;

const ActionsColumn = styled(Column)`
  padding-left: ${space(1.5)};
  .anchor-right .dropdown-menu {
    :before {
      right: 0;
    }
    :after {
      right: 1px;
    }
  }
`;

const VerticalEllipsisIcon = styled(IconEllipsis)`
  color: ${p => p.theme.gray500};
  transform: rotate(90deg);
  display: flex;
  margin-right: 1px;
`;

const Author = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  strong {
    color: ${p => p.theme.gray400};
  }
`;

const StyledExternalLink = styled(ExternalLink)`
  ${overflowEllipsis};
`;
