import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {
  BulkActions,
  useBulkActions,
} from 'sentry/components/workflowEngine/useBulkActions';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  type Detector,
  DetectorListRow,
} from 'sentry/views/detectors/components/detectorListRow';

type DetectorListTableProps = {
  detectors: Detector[];
};

function DetectorListTable({detectors}: DetectorListTableProps) {
  const {
    selectedRows,
    handleSelect,
    isSelectAllChecked,
    toggleSelectAll,
    bulkActionsVisible,
    canDelete,
  } = useBulkActions(detectors);

  return (
    <Panel>
      <StyledPanelHeader>
        <BulkActions
          bulkActionsVisible={bulkActionsVisible}
          canDelete={canDelete}
          isSelectAllChecked={isSelectAllChecked}
          toggleSelectAll={toggleSelectAll}
        />
        <Flex className="last-issue">
          <HeaderDivider />
          <Heading>{t('Last Issue')}</Heading>
        </Flex>
        <Flex className="open-issues">
          <HeaderDivider />
          <Heading>{t('Open Issues')}</Heading>
        </Flex>
        <Flex className="connected-automations">
          <HeaderDivider />
          <Heading>{t('Connected Automations')}</Heading>
        </Flex>
      </StyledPanelHeader>
      <PanelBody>
        {detectors.map(detector => (
          <DetectorListRow
            key={detector.id}
            automations={detector.automations}
            groups={detector.groups}
            id={detector.id}
            link={detector.link}
            name={detector.name}
            project={detector.project}
            details={detector.details}
            handleSelect={handleSelect}
            selected={selectedRows.includes(detector.id)}
            disabled={detector.disabled}
          />
        ))}
      </PanelBody>
    </Panel>
  );
}

const HeaderDivider = styled('div')`
  background-color: ${p => p.theme.gray200};
  width: 1px;
  border-radius: ${p => p.theme.borderRadius};
`;

const Heading = styled('div')`
  display: flex;
  padding: 0 ${space(2)};
  color: ${p => p.theme.subText};
  align-items: center;
`;

const StyledPanelHeader = styled(PanelHeader)`
  justify-content: left;
  padding: ${space(0.75)} ${space(2)};
  min-height: 40px;
  align-items: center;
  display: grid;

  .open-issues,
  .last-issue,
  .connected-automations {
    display: none;
  }

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    grid-template-columns: 3fr 1fr;

    .open-issues {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 3fr 1fr 0.6fr;

    .last-issue {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 2.5fr 1fr 0.75fr 1fr;

    .connected-automations {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: 3fr 1fr 0.75fr 1fr;
  }
`;

export default DetectorListTable;
