import {useCallback} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import metricsOptInImg from 'sentry-images/spot/illustration-metrics.png';

import {type ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {updateOrganization} from '../../actionCreators/organizations';

export function openOptInModal(organization: Organization) {
  return openModal(
    deps => (
      <OrganizationContext.Provider value={organization}>
        <OptInModal {...deps} closeModal={() => {}} />
      </OrganizationContext.Provider>
    ),
    {modalCss}
  );
}

function OptInModal({}: ModalRenderProps) {
  const organization = useOrganization();
  const api = useApi();

  const handleOptIn = useCallback(async () => {
    await api.requestPromise(`/organizations/${organization.slug}/metrics/emroll`, {
      method: 'PUT',
    });

    updateOrganization({
      id: organization.id,
      customMetricsAccess: true,
      features: organization.features?.concat('ddm-ui'),
    });
  }, [api, organization.features, organization.id, organization.slug]);

  return (
    <Content>
      <Subheader>{t('Sentry Metrics: Now in Beta')}</Subheader>
      <Header>{t('Track and solve what matters')}</Header>
      <p>
        {t(
          'Create custom metrics to track and visualize the data points you care about over time, like processing time, checkout conversion rate, or user signups, and pinpoint and solve issues faster by using correlated traces.'
        )}
      </p>
      <ListHeader>{t('A few notes:')}</ListHeader>
      <List>
        <li>{t('This is a beta, so it may be buggy - we recognise the irony.')}</li>
        <li>
          {t('If we hit any scaling issues, we may need to turn off metrics ingestion.')}
        </li>
        <li>
          {t(
            'We plan to charge for it in the future once it becomes generally available, but it is completely free to use during the beta.'
          )}
        </li>
      </List>
      <ButtonGroup>
        <LinkButton external href="https://help.sentry.io">
          {t('Learn more')}
        </LinkButton>
        <Button onClick={handleOptIn} priority="primary">
          {t("I'm In")}
        </Button>
      </ButtonGroup>
    </Content>
  );
}

const Content = styled('div')`
  background: top no-repeat url('${metricsOptInImg}');
  background-size: contain;
  margin-inline: -46px;
  padding: 170px 46px 32px 46px;
  font-size: ${p => p.theme.fontSizeMedium};
  p,
  ul {
    line-height: 1.6rem;
  }
`;

const Subheader = styled('h2')`
  color: ${p => p.theme.purple300};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: bold;
  margin-bottom: ${space(3)};
  text-transform: uppercase;
`;

const Header = styled('h1')`
  font-size: ${p => p.theme.headerFontSize};
  font-weight: bold;
  margin: ${space(1.5)} 0;
`;

const ListHeader = styled('div')`
  margin: ${space(1)};
`;

const List = styled('ul')`
  margin: ${space(1)};
`;

const ButtonGroup = styled('div')`
  display: flex;
  justify-content: flex-end;
  gap: ${space(1)};
`;

export const modalCss = css`
  width: 100%;
  max-width: 532px;

  [role='document'] {
    position: relative;
    padding: 0 45px;
    overflow: hidden;
    box-shadow: none;
  }
`;
