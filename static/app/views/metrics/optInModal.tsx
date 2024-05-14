import {useCallback} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import HeroImg from 'sentry-images/spot/custom-metrics-opt-in-modal-hero.png';

import {type ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import {Button, type ButtonProps, LinkButton} from 'sentry/components/button';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import {OrganizationContext} from 'sentry/views/organizationContext';

export function useOptInModal() {
  const organization = useOrganization();
  const [dismissedModal, setDismissedModal] = useLocalStorageState(
    'sentry:metrics-opt-in-modal-dismissed',
    false
  );

  if (!dismissedModal) {
    openMetricsOptInModal(organization, setDismissedModal);
  }
}

function openMetricsOptInModal(
  organization: Organization,
  setDismissedModal: (value: boolean) => void
) {
  return openModal(
    deps => (
      <OrganizationContext.Provider value={organization}>
        <OptInModal
          {...deps}
          closeModal={() => {
            setDismissedModal(true);
            deps.closeModal();
          }}
        />
      </OrganizationContext.Provider>
    ),
    {modalCss, closeEvents: 'none'}
  );
}

function OptInModal({closeModal}: ModalRenderProps) {
  const organization = useOrganization();

  const handleCloseModal = useCallback(
    source => {
      trackAnalytics('ddm.opt_in_modal_closed', {organization, source});
      closeModal();
    },
    [organization, closeModal]
  );

  return (
    <Content>
      <Subheader>{t('Sentry Metrics: Now in Beta')}</Subheader>
      <Header>{t('Track and solve what matters')}</Header>
      <CloseButton onClick={() => handleCloseModal('close_button')} />
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
        <LinkButton
          external
          href="https://sentry.zendesk.com/hc/en-us/articles/24886170163867-Metrics-Beta-FAQ"
          onClick={() => {
            trackAnalytics('ddm.opt_in_modal_closed', {
              organization,
              source: 'learn_more',
            });
          }}
        >
          {t('Learn more')}
        </LinkButton>
        <Button onClick={() => handleCloseModal('im_in')} priority="primary">
          {t("I'm In")}
        </Button>
      </ButtonGroup>
      <Note>
        {t(
          'Metrics is currently supported in the following SDKs, with more coming soon: JavaScript, Node.js, Python, PHP, Laravel, Symfony, Ruby, Rust, Java, React Native, Unity & .NET.'
        )}
      </Note>
    </Content>
  );
}

const Content = styled('div')`
  background: top no-repeat url('${HeroImg}');
  background-size: contain;
  margin-inline: -46px;
  padding: 170px 46px 32px 46px;
  font-size: ${p => p.theme.fontSizeMedium};
  border-radius: ${p => p.theme.borderRadius};
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

const Note = styled('div')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  margin-top: ${space(2)};
  line-height: 1rem;
`;

const CloseButton = styled((p: Omit<ButtonProps, 'aria-label'>) => (
  <Button
    aria-label={t('Close Modal')}
    icon={<IconClose legacySize="10px" />}
    size="zero"
    {...p}
  />
))`
  position: absolute;
  top: 0;
  right: 0;
  transform: translate(50%, -50%);
  border-radius: 50%;
  height: 24px;
  width: 24px;
`;

export const modalCss = css`
  width: 100%;
  max-width: 532px;

  [role='document'] {
    position: relative;
    padding: 0 45px;
    box-shadow: none;
  }
`;
