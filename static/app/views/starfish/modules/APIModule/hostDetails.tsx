import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import CircleIndicator from 'sentry/components/circleIndicator';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  ERROR_CODE_DESCRIPTIONS,
  EXTERNAL_APIS,
} from 'sentry/views/starfish/modules/APIModule/constants';
import {MeterBar} from 'sentry/views/starfish/modules/APIModule/hostTable';
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
