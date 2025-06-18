import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {
  AutomationListRow,
  AutomationListRowSkeleton,
} from 'sentry/views/automations/components/automationListTable/row';
import {AUTOMATION_LIST_PAGE_LIMIT} from 'sentry/views/automations/constants';

type AutomationListTableProps = {
  automations: Automation[];
  isError: boolean;
  isPending: boolean;
};

function LoadingSkeletons() {
  return Array.from({length: AUTOMATION_LIST_PAGE_LIMIT}).map((_, index) => (
    <AutomationListRowSkeleton key={index} />
  ));
}

function TableHeader() {
  return (
    <StyledPanelHeader>
      <Flex className="name">
        <Heading>{t('Name')}</Heading>
      </Flex>
      <Flex className="last-triggered">
        <Heading>{t('Last Triggered')}</Heading>
      </Flex>
      <Flex className="action">
        <HeaderDivider />
        <Heading>{t('Actions')}</Heading>
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
  );
}

function AutomationListTable({
  automations,
  isPending,
  isError,
}: AutomationListTableProps) {
  if (isError) {
    return (
      <PanelGrid>
        <TableHeader />
        <PanelBody>
          <LoadingError />
        </PanelBody>
      </PanelGrid>
    );
  }

  if (isPending) {
    return (
      <PanelGrid>
        <TableHeader />
        <LoadingSkeletons />
      </PanelGrid>
    );
  }

  return (
    <PanelGrid>
      <TableHeader />
      {automations.map(automation => (
        <AutomationListRow key={automation.id} automation={automation} />
      ))}
    </PanelGrid>
  );
}

const PanelGrid = styled(Panel)`
  display: grid;
  grid-template-columns: 1fr;

  .last-triggered,
  .action,
  .projects,
  .connected-monitors {
    display: none;
  }

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    grid-template-columns: 2.5fr 1fr;

    .projects {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 2.5fr 1fr 1fr;

    .action {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 2.5fr 1fr 1fr 1fr;

    .last-triggered {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: minmax(0, 3fr) 1fr 1fr 1fr 1fr;

    .connected-monitors {
      display: flex;
    }
  }
`;

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
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1/-1;

  justify-content: left;
  padding: ${space(0.75)} ${space(2)};
  min-height: 40px;
  align-items: center;
  text-transform: none;
`;

export default AutomationListTable;
