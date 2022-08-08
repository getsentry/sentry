import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

const KEYS_TO_DISPLAY = ['name', 'platform', 'version', 'transactionName'] as const;
const NAME_TO_DISPLAY: Record<typeof KEYS_TO_DISPLAY[number], string> = {
  name: t('Name'),
  platform: t('Platform'),
  transactionName: t('Transaction'),
  version: t('Version'),
};

export function ProfileDetails() {
  const [profileGroup] = useProfileGroup();

  if (profileGroup.type !== 'resolved') {
    return null;
  }

  return (
    <FrameBar>
      <FrameTableHeader>
        <TableHeaderCell style={{width: 140}}>{t('Key')}</TableHeaderCell>
        <TableHeaderCell>{t('Value')}</TableHeaderCell>
      </FrameTableHeader>
      {KEYS_TO_DISPLAY.map(key => (
        <TableRow key={key}>
          <Td>{NAME_TO_DISPLAY[key]}</Td>
          <Td>
            {profileGroup.data[key]}
            {key === 'platform' ? (
              <StyledPlatformIcon format="sm" platform={profileGroup.data.platform} />
            ) : null}
          </Td>
        </TableRow>
      ))}
      <TableRow style={{height: '100%'}}>
        <Td rowSpan={100} />
        <Td rowSpan={100} />
      </TableRow>
    </FrameBar>
  );
}

const StyledPlatformIcon = styled(PlatformIcon)`
  margin-left: ${space(1)};
`;

const FrameBar = styled('table')`
  overflow: auto;
  width: 100%;
  position: relative;
  background-color: ${p => p.theme.surface100};
  border-top: 1px solid ${p => p.theme.border};
  flex: 1 1 100%;
  margin: 0;
`;

const FrameTableHeader = styled('tr')`
  top: 0;
  z-index: 1;
  position: sticky;
  width: 100%;
  height: 24px;
  background-color: ${p => p.theme.background};

  > th {
    font-weight: normal;
    position: relative;
    border-bottom: 1px solid ${p => p.theme.border};
    white-space: nowrap;

    &:last-child {
      flex: 1;
    }

    &:not(:last-child) {
      border-right: 1px solid ${p => p.theme.border};
    }
  }
`;

const TableRow = styled('tr')`
  height: 24px;
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 24px;

  > div:not(:last-child) {
    border-right: 1px solid ${p => p.theme.border};
  }
`;

const TableHeaderCell = styled('th')`
  padding: 0 ${space(1)};
  border: none;
  background-color: ${props => props.theme.surface400};
  transition: background-color 100ms ease-in-out;
  line-height: 24px;
  font-size: ${p => p.theme.fontSizeSmall};

  svg {
    width: 10px;
    height: 10px;
  }
`;

const Td = styled('td')`
  padding: 0 ${space(1)};

  &:not(:last-child) {
    border-right: 1px solid ${p => p.theme.border};
  }
`;
