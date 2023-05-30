import {ReactNode} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import CircleIndicator from 'sentry/components/circleIndicator';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getDuration} from 'sentry/utils/formatters';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  getHostStatusBreakdownEventView,
  getHostStatusBreakdownQuery,
} from 'sentry/views/starfish/modules/APIModule/queries';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

type Props = {
  host: string;
};

export function HostDetails({host}: Props) {
  const theme = useTheme();
  const pageFilter = usePageFilters();
  const {isLoading: isStatusBreakdownLoading, data: statusBreakdown} = useSpansQuery({
    queryString: getHostStatusBreakdownQuery({
      domain: host,
      datetime: pageFilter.selection.datetime,
    }),
    eventView: getHostStatusBreakdownEventView({
      domain: host,
      datetime: pageFilter.selection.datetime,
    }),
    initialData: [],
  });

  const hostMarketingName = Object.keys(EXTERNAL_APIS).find(key => host.includes(key));

  const failures = statusBreakdown?.filter((item: any) => item.status > 299);
  const successes = statusBreakdown?.filter((item: any) => item.status < 300);
  const totalCount = statusBreakdown?.reduce(
    (acc: number, item: any) => acc + item.count,
    0
  );

  const externalApi = hostMarketingName && EXTERNAL_APIS[hostMarketingName];

  const {isLoading: isStatusLoading, data: statusData} = useQuery({
    queryKey: ['domain-status', host],
    queryFn: () =>
      fetch(`${externalApi?.statusPage}?format=json`).then(res => res.json()),
    retry: false,
    refetchOnWindowFocus: false,
    initialData: {},
    enabled: !!externalApi,
  });

  return (
    <DetailsContainer>
      <FlexContainer>
        {externalApi?.faviconLink && (
          <img
            src={externalApi.faviconLink}
            width="16"
            height="16"
            style={{marginRight: space(1)}}
          />
        )}

        {hostMarketingName ? (
          <span>
            <Host>{hostMarketingName}</Host>
            <span>{` (${host})`}</span>
          </span>
        ) : (
          <Host>{host}</Host>
        )}

        {!isStatusLoading && statusData.status ? (
          <StatusText>
            <CircleIndicator size={8} enabled={statusData.status.indicator === 'none'} />{' '}
            {statusData.status.description}
          </StatusText>
        ) : null}

        <LinkContainer>
          {externalApi?.statusPage && (
            <a href={externalApi.statusPage} target="_blank" rel="noreferrer">
              {t('Status')}
              <StyledIconOpen size="xs" />
            </a>
          )}
        </LinkContainer>
      </FlexContainer>
      <ExternalApiDescription>{externalApi?.description}</ExternalApiDescription>
      <StatusContainer>
        {isStatusBreakdownLoading
          ? null
          : failures?.map((item: any) => {
              const errorCodeDescription = ERROR_CODE_DESCRIPTIONS[item.status];
              return (
                <MeterBarContainer key={item.status}>
                  <MeterBar
                    color={theme.red300}
                    meterItems={['count']}
                    minWidth={0.1}
                    row={item}
                    total={totalCount}
                    meterText={
                      <Failure>{`${item.status}${
                        errorCodeDescription ? ` ${errorCodeDescription}` : ''
                      } (${item.count})`}</Failure>
                    }
                  />
                </MeterBarContainer>
              );
            })}
        {isStatusBreakdownLoading
          ? null
          : successes?.map((item: any) => (
              <MeterBarContainer key={item.status}>
                <MeterBar
                  color={theme.green300}
                  meterItems={['count']}
                  minWidth={0.1}
                  row={item}
                  total={totalCount}
                  meterText={`${item.status} (${item.count})`}
                />
              </MeterBarContainer>
            ))}
      </StatusContainer>
    </DetailsContainer>
  );
}

const DetailsContainer = styled('div')`
  padding: ${space(2)};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  margin-bottom: ${space(2)};
`;

const FlexContainer = styled('div')`
  display: flex;
  flex-direction: row;
`;

const Host = styled('span')`
  font-weight: bold;
`;

const StatusText = styled('span')`
  margin-left: ${space(2)};
`;

const StyledIconOpen = styled(IconOpen)`
  flex: 0;
  top: 2px;
  position: relative;
  margin-left: ${space(0.5)};
`;

const LinkContainer = styled('span')`
  flex: 1;
  text-align: right;
`;

const StatusContainer = styled('span')`
  margin-top: ${space(1)};
  flex: 1;
  height: 20px;
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
`;

const MeterBarContainer = styled('div')`
  width: 150px;
  top: -6px;
  position: relative;
`;

const Failure = styled('span')`
  font-weight: bold;
  color: ${p => p.theme.red300};
`;

const ExternalApiDescription = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
`;

const ERROR_CODE_DESCRIPTIONS = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

const EXTERNAL_APIS = {
  stripe: {
    statusPage: 'https://status.stripe.com/',
    faviconLink: 'https://stripe.com/favicon.ico',
    description: t(
      'Stripe is a suite of payment APIs that powers commerce for online businesses of all sizes'
    ),
  },
  twilio: {
    statusPage: 'https://status.twilio.com/',
    faviconLink: 'https://www.twilio.com/favicon.ico',
    description: t('Twilio is a cloud communications platform as a service company.'),
  },
  sendgrid: {
    statusPage: 'https://status.sendgrid.com/',
    faviconLink: 'https://sendgrid.com/favicon.ico',
    description: t(
      'SendGrid is a cloud-based SMTP provider that allows you to send email without having to maintain email servers.'
    ),
  },
  plaid: {
    statusPage: 'https://status.plaid.com/',
    faviconLink: 'https://plaid.com/favicon.ico',
    description: t(
      'Plaid is a technology platform that enables applications to connect with users bank accounts.'
    ),
  },
  paypal: {statusPage: 'https://www.paypal-status.com/'},
  braintree: {statusPage: 'https://status.braintreepayments.com/'},
  clickup: {
    statusPage: 'https://clickup.statuspage.io/',
    faviconLink: 'https://clickup.com/favicon.ico',
    description: t(
      'ClickUp is a productivity platform that provides a fundamentally new way to work.'
    ),
  },
  github: {
    statusPage: 'https://www.githubstatus.com/',
    faviconLink: 'https://github.com/favicon.ico',
    description: t(
      'GitHub is a provider of Internet hosting for software development and version control.'
    ),
  },
  gitlab: {
    statusPage: 'https://status.gitlab.com/',
    faviconLink: 'https://gitlab.com/favicon.ico',
    description: t(
      'GitLab is a web-based DevOps lifecycle tool that provides a Git-repository manager providing wiki, issue-tracking and CI/CD pipeline features.'
    ),
  },
  bitbucket: {
    statusPage: 'https://bitbucket.status.atlassian.com/',
    faviconLink: 'https://bitbucket.org/favicon.ico',
    description: t(
      'Bitbucket is a web-based version control repository hosting service.'
    ),
  },
  jira: {
    statusPage: 'https://jira.status.atlassian.com/',
    faviconLink: 'https://jira.com/favicon.ico',
    description: t(
      'Jira is a proprietary issue tracking product developed by Atlassian.'
    ),
  },
  asana: {
    statusPage: 'https://trust.asana.com/',
    faviconLink: 'https://asana.com/favicon.ico',
    description: t(
      'Asana is a web and mobile application designed to help teams organize, track, and manage their work.'
    ),
  },
  trello: {statusPage: 'https://trello.status.atlassian.com/'},
  zendesk: {statusPage: 'https://status.zendesk.com/'},
  intercom: {statusPage: 'https://www.intercomstatus.com/'},
  freshdesk: {statusPage: 'https://status.freshdesk.com/'},
  linear: {statusPage: 'https://status.linear.app/'},
  gaussMoney: {},
};

export const INTERNAL_API_REGEX = /\d\.\d|localhost/;

export function MeterBar({
  minWidth,
  meterItems,
  row,
  total,
  color,
  meterText,
}: {
  color: string;
  meterItems: string[];
  minWidth: number;
  row: any;
  total: number;
  meterText?: ReactNode;
}) {
  const widths = [] as number[];
  meterItems.reduce((acc, item, index) => {
    const width = Math.max(
      Math.min(
        (100 * row[item]) / total - acc,
        100 - acc - minWidth * (meterItems.length - index)
      ),
      minWidth
    );

    widths.push(width);
    return acc + width;
  }, 0);
  return (
    <span>
      <MeterText>
        {meterText ?? `${getDuration(row[meterItems[0]] / 1000, 0, true, true)}`}
      </MeterText>
      <MeterContainer width={100}>
        <Meter width={widths[0]} color={color} />
      </MeterContainer>
    </span>
  );
}

const MeterContainer = styled('span')<{width: number}>`
  display: flex;
  width: ${p => p.width}%;
  height: ${space(1)};
  background-color: ${p => p.theme.gray100};
  margin-bottom: 4px;
`;

const Meter = styled('span')<{
  color: string;
  width: number;
}>`
  display: block;
  width: ${p => p.width}%;
  height: 100%;
  background-color: ${p => p.color};
`;
const MeterText = styled('span')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.gray300};
  white-space: nowrap;
`;
