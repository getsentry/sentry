import {useCallback, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Link} from 'sentry/components/core/link/link';
import {IconChevron, IconSearch} from 'sentry/icons';
import {DiscordPreview} from 'sentry/notifs/discordPreview';
import {EmailPreview} from 'sentry/notifs/emailPreview';
import {SlackPreview} from 'sentry/notifs/slackPreview';
import {TeamsPreview} from 'sentry/notifs/teamsPreview';
import {ThemeSwitcher} from 'sentry/stories/theme';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import OrganizationContainer from 'sentry/views/organizationContainer';
import RouteAnalyticsContextProvider from 'sentry/views/routeAnalyticsContextProvider';

type NotificationSource = string;

interface NotificationCategory {
  label: string;
  sources: NotificationSource[];
  value: string;
}

export interface NotificationSelection {
  category: NotificationCategory;
  source: NotificationSource;
}

/** TODO(ecosystem): Use actual notification platform items, maybe via API? */
const notificationCategories: NotificationCategory[] = [
  {
    label: 'Alerts',
    value: 'alerts',
    sources: [
      'issue-alert-triggered-error',
      'issue-alert-triggered-performance',
      'metric-alert-critical',
      'metric-alert-warning',
      'metric-alert-resolved',
    ],
  },
  {
    label: 'Workflow',
    value: 'workflow',
    sources: [
      'issue-assigned',
      'issue-archived',
      'issue-resolved',
      'issue-resolved-in-release',
      'issue-resolved-in-commit',
    ],
  },
  {label: 'Deploys', value: 'deploy', sources: ['deploy-created']},
  {
    label: 'Nudges',
    value: 'approval',
    sources: ['member-request', 'integration-request'],
  },
  {
    label: 'Spend',
    value: 'quota',
    sources: ['quota-exceeded', 'quota-warning', 'billing-error'],
  },
  {
    label: 'Weekly Reports',
    value: 'reports',
    sources: ['daily-report', 'weekly-report'],
  },
  {
    label: 'Spike Protection',
    value: 'spike-protection',
    sources: ['spike-protection-triggered', 'spike-protection-resolved'],
  },
];

export default function NotifsIndex() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchInput = useRef<HTMLInputElement>(null);
  const onSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      navigate(
        {
          query: {
            ...location.query,
            query: e.target.value ? e.target.value : undefined,
            name: location.query.name,
          },
        },
        {replace: true}
      );
    },
    [location.query, navigate]
  );

  const filteredNotificationData = useMemo(() => {
    const query = Array.isArray(location.query.query)
      ? location.query.query.join(' ')
      : (location.query.query ?? '');
    return notificationCategories
      .map(nc =>
        nc.label.toLowerCase().includes(query)
          ? nc
          : {
              ...nc,
              sources: nc.sources.filter(source => source.toLowerCase().includes(query)),
            }
      )
      .filter(category => category.sources.length > 0);
  }, [location.query.query]);

  const selectedNotification = useMemo(() => {
    const source = location.query.source;
    if (!source || Array.isArray(source)) {
      return null;
    }

    const category = notificationCategories.find(nc => nc.sources.includes(source));
    if (!category) {
      return null;
    }

    return {category, source};
  }, [location.query.source]);

  return (
    <RouteAnalyticsContextProvider>
      <OrganizationContainer>
        <Layout>
          <HeaderContainer>
            <Link to="/debug/notifications">
              <Title>
                <SentryGradientLogo /> Notification Debugger
                {selectedNotification && <code>: {selectedNotification.source}</code>}
              </Title>
            </Link>
            <ThemeSwitcher />
          </HeaderContainer>
          <AsideContainer>
            <InputGroup>
              <InputGroup.LeadingItems disablePointerEvents>
                <IconSearch />
              </InputGroup.LeadingItems>
              <InputGroup.Input
                ref={searchInput}
                placeholder="Search notifications"
                defaultValue={location.query.query ?? ''}
                onChange={onSearchInputChange}
              />
            </InputGroup>
            {filteredNotificationData.map(item => (
              <NotificationCategory
                key={item.value}
                item={item}
                selection={selectedNotification}
              />
            ))}
          </AsideContainer>
          <BodyContainer>
            <EmailPreview />
            <SlackPreview />
            <DiscordPreview />
            <TeamsPreview />
          </BodyContainer>
        </Layout>
      </OrganizationContainer>
    </RouteAnalyticsContextProvider>
  );
}

function NotificationCategory({
  item,
  selection,
}: {
  item: NotificationCategory;
  selection: {category: NotificationCategory; source: string} | null;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  return (
    <Category key={item.value} open={open} selected={selection?.category === item}>
      <summary onClick={() => setOpen(!open)}>
        <IconChevron size="xs" />
        {item.label}
      </summary>
      <SourceContainer>
        {item.sources.map(source => (
          <NotificationSource
            key={source}
            selected={selection?.source === source}
            onClick={() => {
              if (selection?.source === source) {
                navigate(
                  {query: {...location.query, source: undefined}},
                  {replace: true}
                );
              } else {
                navigate({query: {...location.query, source}}, {replace: true});
              }
            }}
          >
            {source}
          </NotificationSource>
        ))}
      </SourceContainer>
    </Category>
  );
}

const Layout = styled('div')`
  display: grid;
  grid-template:
    'head head' max-content
    'aside body' auto / 240px 1fr;
  gap: ${space(2)};
  place-items: stretch;
  height: 100vh;
  padding: ${space(2)};
`;

const Title = styled('h1')`
  margin: 0;
  display: flex;
  gap: ${space(1)};
  align-items: center;
  font-size: 24px;
  color: ${p => p.theme.textColor};
  svg {
    width: 36px;
    height: 36px;
    margin-right: ${space(0.5)};
  }
`;

const HeaderContainer = styled('div')`
  grid-area: head;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const AsideContainer = styled('div')`
  grid-area: aside;
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  min-height: 0;
  position: relative;
  z-index: 10;
`;

const BodyContainer = styled('div')`
  grid-area: body;
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const Category = styled('details')<{selected: boolean}>`
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => (p.selected ? p.theme.green100 : 'transparent')};
  padding: ${space(1)};
  summary {
    margin-left: ${space(1)};
    cursor: pointer;
    user-select: none;
    font-weight: bold;
    svg {
      transition: transform 0.2s ease;
      margin-right: ${space(0.5)};
      transform: rotate(90deg);
    }
  }
  &[open] summary svg {
    transform: rotate(180deg);
  }
`;

const SourceContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
  margin-left: 24px;
`;

const NotificationSource = styled('button')<{selected: boolean}>`
  outline: none;
  border: none;
  background: transparent;
  text-align: left;
  text-decoration: ${p => (p.selected ? 'underline' : 'none')};
  text-decoration-color: ${p => p.theme.green400};
  text-decoration-thickness: 1px;
`;

function SentryGradientLogo() {
  const theme = useTheme();
  return (
    <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="500" height="500" rx="53" fill="url(#paint0_linear_0_22)" />
      <path
        d="M277.351 112.292C274.466 107.504 270.392 103.543 265.525 100.793C260.658 98.0433 255.163 96.5984 249.573 96.5984C243.983 96.5984 238.488 98.0433 233.621 100.793C228.754 103.543 224.68 107.504 221.795 112.292L176.101 190.556C211.01 207.984 240.752 234.241 262.376 266.718C283.999 299.196 296.751 336.765 299.365 375.694H267.282C264.672 342.324 253.394 310.214 234.564 282.541C215.734 254.868 190.004 232.592 159.92 217.917L117.629 291.042C134.541 298.626 149.274 310.341 160.475 325.11C171.675 339.878 178.983 357.225 181.726 375.556H108.045C107.172 375.494 106.327 375.215 105.588 374.746C104.848 374.276 104.237 373.629 103.81 372.865C103.383 372.1 103.153 371.241 103.141 370.365C103.128 369.489 103.334 368.624 103.74 367.847L124.157 333.125C117.239 327.354 109.334 322.883 100.823 319.931L80.6149 354.653C78.5111 358.261 77.1453 362.252 76.5969 366.393C76.0485 370.534 76.3284 374.742 77.4204 378.774C78.5123 382.806 80.3945 386.58 82.9576 389.878C85.5208 393.177 88.7137 395.932 92.351 397.986C97.1433 400.686 102.545 402.12 108.045 402.153H208.948C210.822 379.028 206.693 355.812 196.96 334.751C187.226 313.691 172.22 295.502 153.393 281.944L169.434 254.167C193.194 270.486 212.288 292.718 224.832 318.67C237.376 344.622 242.935 373.396 240.962 402.153H326.448C328.439 358.59 318.962 315.268 298.964 276.516C278.966 237.763 249.148 204.938 212.49 181.319L244.92 125.764C245.643 124.553 246.815 123.677 248.18 123.326C249.546 122.974 250.995 123.177 252.212 123.889C255.893 125.903 393.115 365.347 395.684 368.125C396.137 368.937 396.367 369.853 396.352 370.783C396.337 371.712 396.076 372.621 395.597 373.417C395.118 374.213 394.437 374.869 393.623 375.318C392.809 375.766 391.891 375.992 390.962 375.972H357.907C358.323 384.815 358.323 393.634 357.907 402.431H391.101C395.316 402.458 399.495 401.649 403.395 400.051C407.296 398.453 410.84 396.097 413.824 393.12C416.808 390.142 419.172 386.603 420.778 382.706C422.385 378.809 423.203 374.632 423.184 370.417C423.188 364.849 421.702 359.382 418.879 354.583L277.351 112.292Z"
        fill="white"
      />
      <defs>
        <linearGradient
          id="paint0_linear_0_22"
          x1="282.585"
          y1="-24.8338"
          x2="557.555"
          y2="430.917"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={theme.green300} />
          <stop offset="1" stopColor={theme.yellow300} />
        </linearGradient>
      </defs>
    </svg>
  );
}
