import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Release} from 'app/types';
import space from 'app/styles/space';
import Button from 'app/components/button';
import {IconEllipsis} from 'app/icons';
import Confirm from 'app/components/confirm';
import DropdownLink from 'app/components/dropdownLink';
import MenuItem from 'app/components/menuItem';

import {archiveRelease, restoreRelease} from './utils';
import {isReleaseArchived} from '../utils';

type Props = {
  orgId: string;
  release: Release;
  refetchData: () => void;
};

const ReleaseActions = ({orgId, release, refetchData}: Props) => {
  const handleArchive = () => {
    archiveRelease(orgId, release.version);
  };

  const handleRestore = () => {
    restoreRelease(orgId, release.version, refetchData);
  };

  return (
    <Wrapper>
      <StyledDropdownLink
        caret={false}
        anchorRight
        title={<StyledButton icon={<IconEllipsis />} label={t('Actions')} />}
      >
        {isReleaseArchived(release) ? (
          <Confirm
            onConfirm={handleRestore}
            message={
              <p>
                {t(
                  'Restoring this release will also affect other projects associated with it. Are you sure you wish to continue?'
                )}
              </p>
            }
            cancelText={t('Nevermind')}
            confirmText={t('Restore')}
          >
            <MenuItem>{t('Restore')}</MenuItem>
          </Confirm>
        ) : (
          <Confirm
            onConfirm={handleArchive}
            message={t(
              'Archiving this release will also affect other projects associated with it. Are you sure you wish to continue?'
            )}
            cancelText={t('Nevermind')}
            confirmText={t('Restore')}
          >
            <MenuItem>{t('Archive')}</MenuItem>
          </Confirm>
        )}
      </StyledDropdownLink>
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: min-content;
  grid-gap: ${space(0.5)};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    width: 100%;
    margin: ${space(1)} 0 ${space(2)} 0;
  }
`;

const StyledButton = styled(Button)`
  width: 40px;
  height: 40px;
  padding: 0;
`;

const StyledDropdownLink = styled(DropdownLink)`
  & + .dropdown-menu {
    top: 50px !important;
  }
`;

export default ReleaseActions;
