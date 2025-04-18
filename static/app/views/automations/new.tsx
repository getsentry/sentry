import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Button, LinkButton} from 'sentry/components/core/button';
import {Card} from 'sentry/components/workflowEngine/ui/card';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import EditConnectedMonitors from 'sentry/views/automations/components/editConnectedMonitors';
import NewAutomationLayout from 'sentry/views/automations/layouts/new';

export default function AutomationNew() {
  useWorkflowEngineFeatureGate({redirect: true});
  const [monitor1Connected, setMonitor1Connected] = useState(true);
  const [monitor2Connected, setMonitor2Connected] = useState(true);
  const [monitor3Connected, setMonitor3Connected] = useState(false);
  const [monitor4Connected, setMonitor4Connected] = useState(false);
  const [monitor5Connected, setMonitor5Connected] = useState(false);
  const [monitor6Connected, setMonitor6Connected] = useState(false);
  const [monitor7Connected, setMonitor7Connected] = useState(false);
  const [monitor8Connected, setMonitor8Connected] = useState(false);
  const [monitor9Connected, setMonitor9Connected] = useState(false);
  const [monitor10Connected, setMonitor10Connected] = useState(false);

  const data: MonitorsData[] = [
    {
      name: {
        name: 'Error Grouping',
        project: {
          slug: 'javascript',
          platform: 'javascript',
        },
        link: '/issues/1',
      },
      lastIssue: {shortId: 'JAVASCRIPT-SHGH', platform: 'javascript'},
      type: 'errors',
      createdBy: 'sentry',
      connect: {connected: monitor1Connected, toggleConnected: setMonitor1Connected},
    },
    {
      name: {
        name: 'Endpoint Regression',
        project: {
          slug: 'javascript',
          platform: 'javascript',
        },
        link: '/issues/1',
      },
      lastIssue: {shortId: 'JAVASCRIPT-SHGH', platform: 'javascript'},
      type: 'metric',
      createdBy: {
        email: 'miahsu@sentry.io',
        name: 'Mia Hsu',
        username: 'f4ea91ef8dc34fe8a54b3732030fbf7b',
        id: '3286015',
        ip_address: '1.1.1.1',
      },
      connect: {connected: monitor2Connected, toggleConnected: setMonitor2Connected},
    },
    {
      name: {
        name: 'Consecutive DB Queries',
        project: {
          slug: 'javascript',
          platform: 'javascript',
        },
        link: '/issues/1',
      },
      lastIssue: {shortId: 'JAVASCRIPT-SHGH', platform: 'javascript'},
      type: 'trace',
      createdBy: 'sentry',
      connect: {connected: monitor3Connected, toggleConnected: setMonitor3Connected},
    },
    {
      name: {
        name: 'Consecutive HTTP',
        project: {
          slug: 'javascript',
          platform: 'javascript',
        },
        link: '/issues/1',
      },
      type: 'trace',
      createdBy: 'sentry',
      connect: {connected: monitor4Connected, toggleConnected: setMonitor4Connected},
    },
    {
      name: {
        name: 'N+1 API Call',
        project: {
          slug: 'javascript',
          platform: 'javascript',
        },
        link: '/issues/1',
      },
      lastIssue: {shortId: 'JAVASCRIPT-SHGH', platform: 'javascript'},
      type: 'trace',
      createdBy: {
        email: 'cathy.teng@sentry.io',
        name: 'Cathy Teng',
        id: '2120569',
        ip_address: '1.1.1.1',
      },
      connect: {connected: monitor5Connected, toggleConnected: setMonitor5Connected},
    },
    {
      name: {
        name: 'Slow DB Query',
        project: {
          slug: 'javascript',
          platform: 'javascript',
        },
        link: '/issues/1',
      },
      type: 'trace',
      createdBy: {
        email: 'michelle.fu@sentry.io',
        name: 'Michelle Fu',
        id: '2787837',
        ip_address: '1.1.1.1',
      },
      connect: {connected: monitor6Connected, toggleConnected: setMonitor6Connected},
    },
    {
      name: {
        name: 'Uncompressed Asset',
        project: {
          slug: 'javascript',
          platform: 'javascript',
        },
        link: '/issues/1',
      },
      lastIssue: {shortId: 'JAVASCRIPT-SHGH', platform: 'javascript'},
      type: 'errors',
      createdBy: {
        email: 'christina.long@sentry.io',
        name: 'Christina Long',
        id: '3284085',
        ip_address: '1.1.1.1',
      },
      connect: {connected: monitor7Connected, toggleConnected: setMonitor7Connected},
    },
    {
      name: {
        name: 'Rage Click',
        project: {
          slug: 'javascript',
          platform: 'javascript',
        },
        link: '/issues/1',
      },
      lastIssue: {shortId: 'JAVASCRIPT-SHGH', platform: 'javascript'},
      type: 'replay',
      createdBy: {
        email: 'raj.joshi@sentry.io',
        name: 'Raj Joshi',
        id: '3068985',
        ip_address: '1.1.1.1',
      },
      connect: {connected: monitor8Connected, toggleConnected: setMonitor8Connected},
    },
    {
      name: {
        name: 'Error Grouping',
        project: {
          slug: 'javascript',
          platform: 'javascript',
        },
        link: '/issues/1',
      },
      lastIssue: {shortId: 'JAVASCRIPT-SHGH', platform: 'javascript'},
      type: 'errors',
      createdBy: 'sentry',
      connect: {connected: monitor9Connected, toggleConnected: setMonitor9Connected},
    },
    {
      name: {
        name: 'Error Grouping',
        project: {
          slug: 'javascript',
          platform: 'javascript',
        },
        link: '/issues/1',
      },
      lastIssue: {shortId: 'JAVASCRIPT-SHGH', platform: 'javascript'},
      type: 'errors',
      createdBy: 'sentry',
      connect: {connected: monitor10Connected, toggleConnected: setMonitor10Connected},
    },
  ];

  return (
    <NewAutomationLayout>
      <ContentWrapper>
        <Flex column gap={space(1.5)} style={{padding: space(2)}}>
          <Card>
            <EditConnectedMonitors />
          </Card>
          <span>
            <Button icon={<IconAdd />}>{t('Create New Monitor')}</Button>
          </span>
        </Flex>
      </ContentWrapper>
      <StyledStickyFooter>
        <StickyFooterLabel>{t('Step 1 of 2')}</StickyFooterLabel>
        <Flex gap={space(1)}>
          <LinkButton priority="default" to="/issues/automations">
            {t('Cancel')}
          </LinkButton>
          <LinkButton priority="primary" to="settings">
            {t('Next')}
          </LinkButton>
        </Flex>
      </StyledStickyFooter>
    </NewAutomationLayout>
  );
}

const ContentWrapper = styled('div')`
  position: relative;
`;

const StyledStickyFooter = styled(StickyFooter)`
  z-index: ${p => p.theme.zIndex.initial};
`;
