import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {DetectorListRow} from 'sentry/views/detectors/components/detectorListRow';

type DetectorListTableProps = {
  detectors: Detector[];
};

function DetectorListTable({detectors}: DetectorListTableProps) {
  return (
    <Panel>
      <StyledPanelHeader>
        <Flex className="type">
          <Heading>{t('Type')}</Heading>
        </Flex>
        <Flex className="issue">
          <HeaderDivider />
          <Heading>{t('Last Issue')}</Heading>
        </Flex>
        <Flex className="owner">
          <HeaderDivider />
          <Heading>{t('Owner')}</Heading>
        </Flex>
        <Flex className="connected-automations">
          <HeaderDivider />
          <Heading>{t('Automations')}</Heading>
        </Flex>
      </StyledPanelHeader>
      <PanelBody>
        {detectors.map(detector => (
          <DetectorListRow key={detector.id} detector={detector} />
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

  .type,
  .creator,
  .last-issue,
  .connected-automations {
    display: none;
  }

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    grid-template-columns: 3fr 0.8fr;

    .type {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 3fr 0.8fr 1.5fr 0.8fr;

    .last-issue {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 3fr 0.8fr 1.5fr 0.8fr;

    .creator {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: 4.5fr 0.8fr 1.5fr 0.8fr 2fr;

    .connected-automations {
      display: flex;
    }
  }
`;

export default DetectorListTable;
