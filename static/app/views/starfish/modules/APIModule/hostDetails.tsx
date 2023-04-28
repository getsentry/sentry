import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import usePageFilters from 'sentry/utils/usePageFilters';
import {MeterBar} from 'sentry/views/starfish/modules/APIModule/hostTable';
import {getHostStatusBreakdownQuery} from 'sentry/views/starfish/modules/APIModule/queries';
import {HOST} from 'sentry/views/starfish/utils/constants';

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
  },
  sendgrid: {
    statusPage: 'https://status.sendgrid.com/',
    faviconLink: 'https://sendgrid.com/favicon.ico',
    description: t(
      'SendGrid is a cloud-based SMTP provider that allows you to send email without having to maintain email servers.'
    ),
  },
  plaid: {statusPage: 'https://status.plaid.com/'},
  paypal: {statusPage: 'https://www.paypal-status.com/'},
  braintree: {statusPage: 'https://status.braintreepayments.com/'},
  clickup: {
    statusPage: 'https://clickup.statuspage.io/',
    faviconLink: 'https://clickup.com/favicon.ico',
    description: t(
      'ClickUp is a productivity platform that provides a fundamentally new way to work.'
    ),
  },
  github: {statusPage: 'https://www.githubstatus.com/'},
  gitlab: {statusPage: 'https://status.gitlab.com/'},
  bitbucket: {statusPage: 'https://bitbucket.status.atlassian.com/'},
  jira: {statusPage: 'https://jira.status.atlassian.com/'},
  asana: {statusPage: 'https://trust.asana.com/'},
  trello: {statusPage: 'https://trello.status.atlassian.com/'},
  zendesk: {statusPage: 'https://status.zendesk.com/'},
  intercom: {statusPage: 'https://www.intercomstatus.com/'},
  freshdesk: {statusPage: 'https://status.freshdesk.com/'},
  linear: {statusPage: 'https://status.linear.app/'},
  gaussMoney: {},
};

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

type Props = {
  host: string;
};

export function HostDetails({host}: Props) {
  const theme = useTheme();
  const pageFilter = usePageFilters();
  const statusBreakdownQuery = getHostStatusBreakdownQuery({
    domain: host,
    datetime: pageFilter.selection.datetime,
  });
  const {isLoading: isStatusBreakdownLoading, data: statusBreakdown} = useQuery({
    queryKey: ['statusBreakdown', statusBreakdownQuery],
    queryFn: () =>
      fetch(`${HOST}/?query=${statusBreakdownQuery}`).then(res => res.json()),
  });
  const hostMarketingName = Object.keys(EXTERNAL_APIS).find(key => host.includes(key));

  const failures = statusBreakdown?.filter((item: any) => item.status > 299);
  const successes = statusBreakdown?.filter((item: any) => item.status < 300);
  const totalCount = statusBreakdown?.reduce(
    (acc: number, item: any) => acc + item.count,
    0
  );

  const externalApi = hostMarketingName && EXTERNAL_APIS[hostMarketingName];

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
