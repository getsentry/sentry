import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {
  BulkActions,
  useBulkActions,
} from 'sentry/components/workflowEngine/useBulkActions';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {AutomationListRow} from 'sentry/views/automations/components/automationListRow';
import {useAutomationsQuery} from 'sentry/views/automations/hooks';

// type AutomationListTableProps = {
//   automations: Automation[];
// };

function AutomationListTable() {
  const {data: automations = [], isLoading} = useAutomationsQuery();

  const {
    selectedRows,
    handleSelect,
    isSelectAllChecked,
    toggleSelectAll,
    bulkActionsVisible,
    canDelete,
  } = useBulkActions(automations);

  return (
    <Panel>
      <StyledPanelHeader>
        <BulkActions
          bulkActionsVisible={bulkActionsVisible}
          canDelete={canDelete}
          isSelectAllChecked={isSelectAllChecked}
          toggleSelectAll={toggleSelectAll}
        />
        <Flex className="last-triggered">
          <HeaderDivider />
          <Heading>{t('Last Triggered')}</Heading>
        </Flex>
        <Flex className="action">
          <HeaderDivider />
          <Heading>{t('Action')}</Heading>
        </Flex>
        <Flex className="projects">
          <HeaderDivider />
          <Heading>{t('Projects')}</Heading>
        </Flex>
        <Flex className="connected-monitors">
          <HeaderDivider />
          <Heading>{t('Monitors')}</Heading>
        </Flex>
      </StyledPanelHeader>
      <PanelBody>
        {isLoading ? <LoadingIndicator /> : null}
        {automations.map(automation => (
          <AutomationListRow
            key={automation.id}
            automation={automation}
            handleSelect={handleSelect}
            selected={selectedRows.includes(automation.id)}
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
  text-transform: none;

  .last-triggered,
  .action,
  .connected-monitors {
    display: none;
  }

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    grid-template-columns: 2.5fr 1fr;

    .action {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 2.5fr 1fr 1fr;

    .last-triggered {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 2.5fr 1fr 1fr 1fr;

    .connected-monitors {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: 3fr 1fr 1fr 1fr 1fr;
  }
`;

export default AutomationListTable;
